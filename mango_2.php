<?php
/**
 * Контроллер виртуальной АТС Манго
 *
 * @author Evgeny Bulgakov
 *
 */
class Mango_2 extends Vats
{

    private $mango_fields = array(
        'records'           => ['id_rec_1', 'id_rec_2', 'id_rec_3'],
        'start'             => 'date_start',
        'finish'            => 'date_finish',
        'answer'            => 'answer',
        'from_extension'    => 'from_extension',
        'from_number'       => 'from_number',
        'to_extension'      => 'to_extension',
        'to_number'         => 'to_number',
        'disconnect_reason' => 'disconnect_reason',
        'line_number'       => 'line_number',
        'location'          => 'location',
        //'create'            => 'create',
        'entry_id'          => 'id_group',
    );
	
	public function __construct()
	{
        parent::__construct();
    }

    /**
     * Построение и отправка запроса к внешней виртуальной АТС
     *
     * @access protected
     * @param string $service Название сервиса
     * @return string ответ от внешней виртуальной АТС
     */
    protected function _build_request($service, $options = array(), $json_encode = TRUE)
	{
        $api = $this->api_settings[Vats::MANGO];
        $path = $api[$service];

        $json = ($json_encode) ? json_encode($options) : $options;
        $opts = array(
            'http' => array(
                'method'  => 'POST',
                'header'  => 'Content-type: application/x-www-form-urlencoded',
                'content' => http_build_query(array(
                    'vpbx_api_key' => $api['api_key'],
                    'json'         => $json,
                    'sign'         => hash('sha256', $api['api_key'].$json.$api['api_salt']),
                ))
            )
        );

        $context = stream_context_create($opts);

        return file_get_contents($api['api_base_url'].$path, false, $context);
    }



    /**
     * Загрузка записи разговора
     *
     * @access public
     * @return file (audio/mp3)
     */
    public function download_record($id_record)
	{
        try {
            if (!$this->user_model->checkLoggedUser()) {
                throw new Exception('NoAuthorisation', 1);
            }

            if (empty($id_record)) {
                throw new Exception('Не указан идентификатор записи разговора', 2);
            }

            $record_file = $this->_build_request('service_download_record', array('recording_id' => $id_record, 'action' => 'download'));

            if (empty($record_file)) {
                throw new Exception('Не удалось получить файл записи разговора от Mango', 3);
            }

        }
        catch (Exception $e) {
            $response = array(
                'status'    => $e->getCode(),
                'message'   => $e->getMessage()
            );
            $this->load->view('header_2');
            echo 'Ошибка. '.implode(': ', $response);
            $this->load->view('footer');
            return false;
        }

        $filename = 'Record_'.$id_record.'.mp3';

        header('Content-type: audio/mp3');
        // It will be called downloaded.pdf
        header('Content-Disposition: attachment; filename="'.$filename.'"');
        ob_clean();

        echo $record_file;
    }

    /**
     * Обновление данных истории звонков
     *
     * @access public
     * @param int $unix_date_from   Дата начала периода в формате unixtime
     * @param int $unix_date_to     Дата окончания периода в формате unixtime
     * @return json
     */
    public function update_history($unix_date_from = 0, $unix_date_to = 0)
	{
        try {
            $this->load->helper('parse_date');

            $statistic_options = array(
                'date_from' => parseDate($this->input->post('date_from', TRUE)),
                'date_to'   => parseDate($this->input->post('date_to', TRUE)),
            );

            if (!empty($unix_date_from) && !empty($unix_date_to)) {
                $statistic_options['date_from'] = $unix_date_from;
                $statistic_options['date_to'] = $unix_date_to;
            }

            if (empty($statistic_options['date_from']) || empty($statistic_options['date_to'])) {
                throw new Exception('Не указана дата начала либо окончания периода', 1);
            }

            $date_limit = mktime(0, 0, 0, date('n', $statistic_options['date_from']) + 1, date('j', $statistic_options['date_from']), date('Y', $statistic_options['date_from']));
            if ($date_limit < $statistic_options['date_to']) {
                throw new Exception('Запрашиваемый период не может превышать один месяц', 2);
            }

            $statistic_options['fields'] = implode(',', array_keys($this->mango_fields));

            $statistic_key = $this->_build_request('service_statistic_request', $statistic_options);

            if (empty($statistic_key)) {
                throw new Exception('Ошибка при получении ключа статистики от Mango', 3);
            }

            $statistic_csv = '';

            for ($try_get_stat = 0; $try_get_stat < 4 && empty($statistic_csv); $try_get_stat++) {
                sleep(1);
                $statistic_csv = $this->_build_request('service_statistic_result', $statistic_key, false);
                //$statistic_csv = file_get_contents('./uploads/temp/mango_history_26_11_15.csv');
            }

            if (empty($statistic_csv)) {
                throw new Exception('Не удалось получить статистику от Mango', 4);
            }

            //file_put_contents('./uploads/temp/mango_history_update.csv', $statistic_csv);

            $vats_mango_fields = [];
            foreach ($this->mango_fields as $mango_field => $vats_field) {
                if (is_array($vats_field)) {
                    foreach ($vats_field as $vf) {
                        $vats_mango_fields[] = $vf;
                    }
                } else {
                    $vats_mango_fields[] = $vats_field;
                }
            }

            $temp_csv = str_replace("\r\n", "\n", $statistic_csv);

            $statistic_data = str_getcsv($temp_csv, "\n");

            foreach ($statistic_data as $k => $csv_record) {
                $temp_record = str_getcsv($csv_record, ';');
                $array_field = (!empty($temp_record[0])) ? explode(',', str_replace(array('[', ']'), '', $temp_record[0])) : array();
                $new_record = array_fill(0, 3, '');

                foreach ($array_field as $m => $val) {
                    $new_record[$m] = $val;
                }

                unset($temp_record[0]);
                foreach ($temp_record as $val) {
                    $new_record[] = $val;
                }

                if (count($vats_mango_fields) != count($new_record)) {
                    throw new Exception('Ошибка при формировании данных, необходимых для записи в базу данных', 5);
                }

                $statistic_data[$k] = array_combine($vats_mango_fields, $new_record);
            }

            $last_event = $this->vats_realtime_call_model->search_one_table('*', array(), 'id DESC', 0, 1, true);


            // Корректировка разницы во времени:
            $TEMP_TIME_FIX = (!empty($last_event['timestamp_delta'])) ? $last_event['timestamp_delta'] : 3550;


            $old_data = $this->vats_history_model->search_one_table('id, id_call_vats', array(
                'date >=' => $statistic_options['date_from'] - $TEMP_TIME_FIX,
                'date <' => $statistic_options['date_to']
            ));

            $existing_data = array_column($old_data, 'id', 'id_call_vats');

            $add_statistic_data = array();
            foreach ($statistic_data as $k => $record) {
                $mango_date = (!empty($record['date_start'])) ? $record['date_start'] : 0;

                $line_number = (!empty($record['line_number'])) ? $record['line_number'] : 0;

                $direction = (!empty($record['to_extension']) && !empty($record['from_extension']))
                    ? 'staff'
                    : (!empty($record['to_extension'])
                        ? 'in'
                        : (!empty($record['from_extension'])
                            ? 'out'
                            : (!empty($record['to_number']) && $record['to_number'] == $line_number
                                ? 'in'
                                : 'out') ));


                $phone = ($direction == 'in')
                    ? $record['from_number']*1
                    : ($direction == 'out' ? $record['to_number']*1 : 0);

                $sip = ($direction == 'in')
                    ? $record['to_extension']*1
                    : ($direction == 'out' ? $record['from_extension']*1 : 0);

                $id_call_vats = $mango_date.'_'.$phone.'_'.$sip;
                if (empty($existing_data[$id_call_vats])) {
                    $add_statistic_data[$id_call_vats] = array(
                        'id_vats'           => Vats::MANGO,
                        'id_call_vats'      => $id_call_vats,
                        'direction'         => $direction,
                        'phone'             => $phone.'',
                        'sip'               => $sip,
                        'date'              => (!empty($record['date_start'])) ? $record['date_start'] - $TEMP_TIME_FIX : 0,
                        'duration'          => (!empty($record['date_finish']) && !empty($record['answer'])) ? $record['date_finish'] - $record['answer'] : 0,
                        'record'            => (!empty($record['id_rec_1'])) ? $record['id_rec_1'] : '',
                        'id_group'          => (!empty($record['id_group'])) ? $record['id_group'] : '',

                        //'line_number'       => $line_number,
                    );
                }
            }

            if (count($add_statistic_data) > 0) {
                $id_last_record = current($this->vats_history_model->search_one_table('id', array(), 'id DESC', 0, 1, true));

                $add_result = $this->add_history($add_statistic_data);

                if (!$add_result) {
                    throw new Exception('Ошибка при добавлении информации в базу данных', 6);
                }

                $associated_lines = $this->associate_history($statistic_options['date_from'], $statistic_options['date_to'], $id_last_record);
            }

            $response = array(
                'status'            => 0,
                'added_lines'       => (!empty($add_statistic_data)) ? count($add_statistic_data) : 0,
                'associated_lines'  => (!empty($associated_lines)) ? count($associated_lines) : 0,
                //'statistic_csv'     => $statistic_csv
            );
        }
        catch (Exception $e) {
            $response = array(
                'status'    => $e->getCode(),
                'message'   => $e->getMessage()
            );
        }

        echo json_encode($response);
    }


    /**
     * События происходящие в ВАТС mango API
     *
     * Манго API вызывает этот метод (events) при срабатывании каких-либо событий в Манго
     *
     * @access  public
     * @param   string  $action действие
     * @return  bool
     */
    public function events ($action)
	{
        switch ($action) {
            case 'call':
                return $this->event_call();
                break;
            default:
                break;
        }
        return false;
    }


    /**
     * Принятие данных от внешней виртуальной АТС, срабатывающих по событию телефонного звонка
     *
     * @access public
     * @return json
     */
    public function event_call()
	{
        $json = $this->input->post('json', TRUE);
        if (empty($json)) {
            $json = $this->input->get('json', TRUE);
        }

        if (empty($json)) {
            return false;
        }

        $json = json_decode($json, true);

        $to_line_number = (!empty($json['to']['line_number'])) ? $json['to']['line_number'] : 0;

        $direction = (!empty($json['to']['extension']) && !empty($json['from']['extension']))
            ? 'staff'
            : (!empty($json['to']['extension'])
                ? 'in'
                : (!empty($json['from']['extension'])
                    ? 'out'
                    : (!empty($json['to']['number']) && $json['to']['number'] == $to_line_number
                        ? 'in'
                        : 'out') ));

        $phone = ($direction == 'in')
            ? $json['from']['number']*1
            : ($direction == 'out' ? $json['to']['number']*1 : 0);

        $sip = ($direction == 'in')
            ? $json['to']['extension']*1
            : ($direction == 'out' ? $json['from']['extension']*1 : 0);

        $data = array(
            'id_vats'           => Vats::MANGO,
            'id_call_vats'      => (!empty($json['call_id']))                   ? $json['call_id'] : '',
            'seq'               => (!empty($json['seq']))                       ? $json['seq']*1 : 0,
            'state'             => (!empty($json['call_state']))                ? $json['call_state'] : '',
            'direction'         => $direction,
            'phone'             => $phone,
            'sip'               => $sip,
            'date'              => (!empty($json['timestamp']))                 ? $json['timestamp']*1 : 0,
            'to_line_number'    => $to_line_number*1,
            'timestamp_delta'   => (!empty($json['timestamp']))                 ? $json['timestamp']*1 - time() : 0,
        );

        return $this->vats_realtime_call_model->add($data);
    }


    /**
     * Инициализация телефонного звонка
     *
     * @access  public
     * @param   string  $phone  телефонный номер
     * @return  json
     */
    public function make_call($phone)
	{
        try {
            if (!$this->user_model->checkLoggedUser()) {
                throw new Exception('NoAuthorisation', 1);
            }

            $user = $this->user_model->get($this->session->userdata('userID'));

            if (empty($user['sip_number'])) {
                throw new Exception('У вас отсутствует SIP номер', 2);
            }

            if (empty($phone)) {
                throw new Exception('Не указан номер абонента', 3);
            }

            $options = array(
                'command_id'=> 'cb_'.$phone.'_'.time(),
                'from'      => array('extension' => $user['sip_number']),
                'to_number' => $phone,
            );

            $request = $this->_build_request('service_make_call', $options);

            $response = array(
                'status'        => 0,
                'request'       => $request
            );
        }
        catch (Exception $e) {
            $response = array(
                'status'    => $e->getCode(),
                'message'   => $e->getMessage()
            );
        }
        echo json_encode($response);
    }

}
