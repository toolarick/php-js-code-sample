<?php
/**
 * Vats - Virtual Automatic Telephone Station
 * Контроллер виртуальной АТС
 *
 * @author Evgeny Bulgakov
 *
 * @property Vats_settings_model $vats_settings_model
 * @property Vats_history_model $vats_history_model
 * @property Vats_realtime_call_model $vats_realtime_call_model
 */
abstract class Vats extends Base_Controller
{

    const MANGO = 1;
    const BEELINE = 2;

    protected $api_settings = array();

    public function __construct()
	{
        parent::__construct();

        $this->load->model(array(
            'vats/vats_settings_model',
            'vats/vats_history_model',
            'vats/vats_realtime_call_model',
        ));

        $settings = $this->vats_settings_model->get_list();

        foreach ($settings as $param) {
            $this->api_settings[$param['id_vats']][$param['variable']] = $param['value'];
        }
    }

    /**
     * Построение и отправка запроса к внешней виртуальной АТС
     *
     * @access protected
     * @param string $service Название сервиса
     * @return string ответ от внешней виртуальной АТС
     */
    abstract protected function _build_request($service);

    /**
     * Загрузка записи разговора
     *
     * @access public
     * @param $id_record
     * @return file (audio/mp3)
     */
    abstract public function download_record($id_record);

    /**
     * Обновление данных истории звонков
     *
     * @access public
     * @return json
     */
    abstract public function update_history();

    /**
     * Принятие данных от внешней виртуальной АТС, срабатывающих по событию телефонного звонка
     *
     * @access public
     * @return json
     */
    abstract public function event_call();

    /**
     * Инициализация телефонного звонка
     *
     * @access  public
     * @param   string  $phone  телефонный номер
     * @return  json
     */
    abstract public function make_call($phone);


    /**
     * Добавление дополненных данных истории звонков
     *
     * Производит добавление [служебных] данных к данным о звонках, записывает их в БД,
     * а также редактирует уже существующие [служебные] данные о других предыдущих
     * звонках. Под [служебными] данными понимаются поля, которые используются в
     * нашем проекте, но не поставляются от телефонии, они формируются на основе
     * получаемых данных. Например такие поля как: `is_need_recall`
     *
     * @access protected
     * @param array $data
     * @return bool
     */
    protected function add_history($data)
	{
        ksort($data);

        $uncheck_phone_recalls = array();
        $phones = array_column($data, 'phone', 'phone');
        $last_calls = $this->vats_history_model->search_last_connected_time(array('phone' => $phones, 'all_time' => 1));

        foreach ($data as $k => $add_data) {
            $number_str = $add_data['phone'].'';

            if ($add_data['duration'] == 0) {
                if (!empty($last_calls[$number_str]) && $last_calls[$number_str]['dial_attempts_after_last_connect'] >= 2
                        && $last_calls[$number_str]['last_connected_time'] < $data[$k]['date']) {
                    $data[$k]['is_need_recall'] = 0;
                    $uncheck_phone_recalls[$number_str] = true;
                } elseif (!empty($last_calls[$number_str]) && $data[$k]['direction'] == 'in'
                        && $last_calls[$number_str]['last_connected_time'] < $data[$k]['date']) {
                    $data[$k]['is_need_recall'] = 1;
                    if (isset($uncheck_phone_recalls[$number_str])) {
                        unset($uncheck_phone_recalls[$number_str]);
                    }
                }

            } else {
                $data[$k]['is_need_recall'] = 0;
                $last_calls[$number_str]['dial_attempts_after_last_connect'] = 0;
                $uncheck_phone_recalls[$number_str] = true;
                if (empty($last_calls[$number_str]['last_connected_time']) || $last_calls[$number_str]['last_connected_time'] < $data[$k]['date']) {
                    $last_calls[$number_str]['last_connected_time'] = $data[$k]['date'];
                }
            }

            if (!isset($data[$k]['is_need_recall'])) {
                $data[$k]['is_need_recall'] = 0;
            }
        }

        $is_add_data = $this->vats_history_model->add($data);

        $is_uncheck_phone_recalls = $this->vats_history_model->uncheck_phone_recalls(array_keys($uncheck_phone_recalls));

        return $is_add_data;
    }


    /**
     * Ассоциирование данных о коммуникациях сотрудника с данными о звонках
     *
     * @access protected
     * @param int $date_from        Дата начала периода поиска
     * @param int $date_to          Дата завершения периода поиска
     * @param int $id_vats_history  Данные о звонках берутся начиная со следующей записи, идущей в порядке возрастания после данного ID записи
     * @return array                Масив ассоциированных идентификаторов array($id_employee_history => $id_vats_history)
     */
    protected function associate_history($date_from, $date_to, $id_vats_history = 0)
	{
        if (empty($date_from) && empty($date_to)) {
            return false;
        }
        $this->load->model('employee/employee_history_model');

        $is_grouping_calls = $this->vats_settings_model->get_active_variable('grouping_calls');

        $vats_history_filter = (!empty($id_vats_history))
            ? array('id >' => $id_vats_history)
            : array('date >=' => $date_from, 'date <=' => $date_to);

        $vats_history = $this->vats_history_model->search_one_table('*', $vats_history_filter);

        $record_ids = array();
        $ids_one_line_calls = array();
        foreach ($vats_history as $record) {
            $phone = (!empty($record['phone'])) ? $record['phone'].'' : 0;
            $str_date = date('d.m.Y', $record['date']);
            $record_ids[$phone][$str_date][] = $record['id'];

            if (!empty($record['duration']) && !empty($record['phone']) && !empty($record['date'])) {
                $one_line_calls = (!empty($is_grouping_calls))
                    ? $this->vats_history_model->search_one_table('id', array(
                        'id_group' => $record['id_group'],
                        'duration'=> 0,
                        'phone'   => $record['phone'],
                    ))
                    : $this->vats_history_model->search_one_table('id', array(
                        'date >=' => $record['date'] - 4,
                        'date <=' => $record['date'] + 4,
                        'duration'=> 0,
                        'phone'   => $record['phone'],
                    ));
                $ids_one_line_calls += array_column($one_line_calls, 'id', 'id');
            }
        }

        if (!empty($ids_one_line_calls)) {
            $this->vats_history_model->update($ids_one_line_calls, array('is_other_manager_answered' => 1));
        }

        $employee_history = $this->employee_history_model->search_with_phone(
            array('eh.creation_date >=' => $date_from, 'eh.creation_date <' => $date_to),
            'eh.creation_date ASC',
            'eh.id_employee, DAYOFMONTH(FROM_UNIXTIME(eh.creation_date))'
        );

        $result = array();
        foreach ($employee_history as $day_history) {
            if (!empty($day_history['phone']) && !empty($day_history['creation_date']) && !empty($day_history['eh_id'])) {
                $day_history_ids = explode(',', $day_history['eh_id']);
                $str_date = date('d.m.Y', $day_history['creation_date']);
                if (!empty($record_ids[$day_history['phone']][$str_date]) && !empty($day_history_ids)) {
                    foreach ($day_history_ids as $id_employee_history) {
                        $id_vats_history = array_shift($record_ids[$day_history['phone']][$str_date]);
                        if (!empty($id_vats_history)) {
                            $is_associated = $this->employee_history_model->update($id_employee_history, array('id_vats_history' => $id_vats_history));
                            if ($is_associated) {
                                $result[$id_employee_history] = $id_vats_history;
                            }
                        }
                    }
                }
            }
        }

        return $result;
    }


}