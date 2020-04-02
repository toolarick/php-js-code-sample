<?php
/**
 * Контроллер виртуальной АТС Билайн
 *
 * @author Evgeny Bulgakov
 *
 */
class Beeline extends Vats
{

    /**
     * Массив информации о завершенном curl запросе
     *
     * @var array
     */
    private $curl_info;

    public function __construct()
	{
        parent::__construct();
    }

    /**
     * Построение и отправка запроса к внешней виртуальной АТС
     *
     * @access protected
     * @param string $service путь к сервису
     * @param array $options
     * @return string ответ от внешней виртуальной АТС
     */
    protected function _build_request($service, $options = array())
	{
        $api = $this->api_settings[Vats::BEELINE];

        if (empty($api[$service])) {
            return false;
        }

        $args = array();

        preg_match_all('/{([^}]+)}/', $api[$service], $args);

        $path = $api[$service];
        if (!empty($args) && !empty($args[1])) {
            foreach ($args[1] as $arg) {
                if (isset($options[$arg])) {
                    $path = str_replace('{'.$arg.'}', "{$options[$arg]}", $path);
                }
            }
        }

        $url_params = (!empty($options['url_params']))
            ? '?'.http_build_query($options['url_params'])
            : '';

        $url = $api['api_base_url'].$path.$url_params;

        $curl_options = array(
            CURLOPT_URL => $url,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_CONNECTTIMEOUT => 30,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION  => 1,
            CURLOPT_HTTPHEADER => array(
                $api['token_header'] => "{$api['token_header']}: {$api['token_value']}",
            ),
        );

        if (!empty($options['put_fields'])) {
            $data_json = json_encode($options['put_fields']);
            $curl_options[CURLOPT_HTTPHEADER][] = 'Content-Type: application/json';
            $curl_options[CURLOPT_HTTPHEADER][] = 'Content-Length: '.strlen($data_json);
            $curl_options[CURLOPT_CUSTOMREQUEST] = 'PUT';
            $curl_options[CURLOPT_POSTFIELDS] = $data_json;
        }

        if (!empty($options['delete'])) {
            $curl_options[CURLOPT_CUSTOMREQUEST] = 'DELETE';
        }

        if (!empty($options['delete_fields'])) {
            $data_json = json_encode($options['delete_fields']);
            $curl_options[CURLOPT_HTTPHEADER][] = 'Content-Type: application/json';
            $curl_options[CURLOPT_HTTPHEADER][] = 'Content-Length: '.strlen($data_json);
            $curl_options[CURLOPT_CUSTOMREQUEST] = 'DELETE';
            $curl_options[CURLOPT_POSTFIELDS] = $data_json;
        }

        if (!empty($options['post_fields'])) {
            $curl_options[CURLOPT_POST] = true;
            $curl_options[CURLOPT_POSTFIELDS] = $options['post_fields'];
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, $curl_options);
        $response = curl_exec($ch);
        $this->curl_info = curl_getinfo($ch);
        curl_close($ch);

        return $response;
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
                throw new Exception('Не указан идентификатор разговора', 2);
            }

            $record_link = $this->_build_request('service_records_reference', array(
                'id' => $id_record
            ));

            if (empty($record_link)) {
                throw new Exception('Не удалось получить ссылку на файл записи разговора', 3);
            }

            $record_link = json_decode($record_link, true);

            if (empty($record_link['url'])) {
                throw new Exception('Не удалось получить ссылку на файл записи разговора', 3);
            }

            $recording_file = file_get_contents($record_link['url']);

            if (empty($recording_file)) {
                throw new Exception('Не удалось получить файл записи разговора', 5);
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
        header('Content-Disposition: attachment; filename="'.$filename.'"');
        ob_clean();

        echo $recording_file;
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

            $request = $this->_build_request('service_make_call', array(
                'pattern' => $user['sip_number'],
                'post_fields' => array('phoneNumber' => $phone),
            ));

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

            $this->load->model('owner_base/owner_base_model');

            $timezone_difference = $this->owner_base_model->get_option_value('timestamp_delta');

            $request_params = array(
                'url_params' => array(),
            );

            $last_id = current($this->vats_history_model->search_one_table('record', array('id_vats' => Vats::BEELINE), 'record DESC', 0, 1, true));

            if (!empty($last_id)) {
                $request_params['url_params']['id'] = $last_id;
            }

            if (!empty($unix_date_from)) {
                $request_params['url_params']['dateFrom'] = date('c', $unix_date_from);
            }

            if (!empty($unix_date_to)) {
                $request_params['url_params']['dateTo'] = date('c', $unix_date_to);
            }

            $beeline_data = $this->_build_request('service_records', $request_params);

            if (empty($beeline_data)) {
                throw new Exception('Ошибка получения данных', 1);
            }

            $beeline_data = json_decode($beeline_data, true);

            $add_statistic_data = array();
            if (!empty($beeline_data)) {
                foreach ($beeline_data as $row) {
                    $id_call_vats = (!empty($row['externalId'])) ? $row['externalId'] : '';

                    if (empty($id_call_vats)) {
                        continue;
                    }

                    $have_same = $this->vats_history_model->search_one_table('id_call_vats', [
                        'id_vats' => Vats::BEELINE,
                        'id_call_vats' => $id_call_vats
                    ]);

                    if ($have_same) {
                        continue;
                    }

                    $add_statistic_data[] = array(
                        'id_vats'       => Vats::BEELINE,
                        'id_call_vats'  => $id_call_vats,
                        'direction'     => (!empty($row['direction']) && $row['direction'] == 'INBOUND') ? 'in' : 'out',
                        'phone'         => (!empty($row['phone'])) ? $row['phone'] : 0,
                        'sip'           => (!empty($row['abonent']['extension'])) ? $row['abonent']['extension'] : '',
                        'date'          => (!empty($row['date'])) ? floor($row['date']/1000) + (!empty($timezone_difference) ? $timezone_difference : 0) : 0,
                        'duration'      => (!empty($row['duration'])) ? floor($row['duration']/1000) : 0,
                        'record'        => (!empty($row['id'])) ? $row['id'] : '',
                    );
                }
            }

            if (count($add_statistic_data) > 0) {
                $add_result = $this->add_history($add_statistic_data);

                if (!$add_result) {
                    throw new Exception('Ошибка при добавлении информации в базу данных', 2);
                }
            }


            $response = array(
                'status'            => 0,
                'added_lines'       => (!empty($add_statistic_data)) ? count($add_statistic_data) : 0,
                'associated_lines'  => 0,
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
     * Принятие данных от внешней виртуальной АТС, срабатывающих по событию телефонного звонка
     *
     * @access public
     * @return json
     */
    public function event_call()
	{
        $this->load->library('pq');

        $this->pq->load_xml_file('php://input');

        // При получении события истечения подписки на получение событий - продлевание подписки
        if (pq('eventData')->attr('xsi1:type') == 'xsi:SubscriptionTerminatedEvent') {
            //$this->_subscribe_events(site_url(strtolower(__CLASS__).'/'.__FUNCTION__));
            return;
        }

        $expected_states = array(
            'Alerting' => array(
                'state' => 'Appeared',
                'date_tag' => 'startTime',
            ),
            'Active' => array(
                'state' => 'Connected',
                'date_tag' => 'answerTime',
            ),
            'Released' => array(
                'state' => 'Disconnected',
                'date_tag' => 'releaseTime',
            )
        );

        $state = pq('call state')->text();
        $date = floor(pq('call '.$expected_states[$state]['date_tag'])->text() / 1000);
        $id_call_vats = pq('callId')->text();

        // Формирование записи в таблицу истории звонков производится здесь.
        // Пока у Билайна не появится отдельный запрос на получение статистики вызовов
        if ('Alerting' == $state) {
            $add_history_data = $this->vats_history_model->add([
                'id_vats'       => Vats::BEELINE,
                'id_call_vats'  => $id_call_vats,
                'direction'     => (pq('call personality')->text() == 'Terminator' ? 'in' : 'out'),
                'phone'         => preg_replace('/\D/', '', pq('call remoteParty address')->text()),
                'sip'           => preg_replace('/@.*/', '', pq('targetId')->text()),
                'date'          => $date,
                'duration'      => 0,
                'record'        => '',
            ]);
        }
        if ('Released' == $state) {
            $vats_history = $this->vats_history_model->search_one_table('id,date', ['id_call_vats' => $id_call_vats], 'id DESC', 0, 1, true);
            if (!empty($vats_history['id'])) {
                $this->vats_history_model->update($vats_history['id'], ['duration' => $date - $vats_history['date']*1]);
            }
        }


        if (empty($expected_states[$state])) {
            return;
        }


        $data = array(
            'id_vats'           => Vats::BEELINE,
            'id_call_vats'      => pq('callId')->text(),
            'seq'               => pq('sequenceNumber')->text(),
            'state'             => $expected_states[$state]['state'],
            'direction'         => (pq('call personality')->text() == 'Terminator' ? 'in' : 'out'), // Terminator -in | Originator -out
            'phone'             => preg_replace('/\D/', '', pq('call remoteParty address')->text()),
            'sip'               => preg_replace('/@.*/', '', pq('targetId')->text()),
            'date'              => $date,
            'to_line_number'    => preg_replace('/\D/', '', pq('redirections address')->filter(':first')->text()),
            'timestamp_delta'   => $date - time(),
        );


        return $this->vats_realtime_call_model->add($data);
    }


    /**
     * Проверка действия и, при необходимости, обновление подписки
     *
     * @access public
     * @return bool
     */
    public function check_update_subscription ()
	{
        $result = (!$this->_check_subscription())
            ? $this->_subscribe_events(site_url(strtolower(__CLASS__).'/event_call'))
            : true;

        return $result;
    }


    /**
     * Подписка на события получения информации о звонках в реальном времени
     *
     * @access private
     * @param string $url   Полный URL адрес к обработчику информации о звонках
     * @param string $type  Тип получаемых событий
     * @return string/bool  Идентификатор подписки либо false
     */
    private function _subscribe_events ($url, $type = 'BASIC_CALL')
	{
        $this->load->helper('url');
        $subsription_result = $this->_build_request('service_subscription', array(
            'put_fields' => array(
                'subscriptionType' => $type,
                'url' => $url,
            )
        ));

        if (empty($subsription_result)) {
            return false;
        }

        $subscription_info = json_decode($subsription_result, true);
        if (empty($subscription_info['subscriptionId'])) {
            return false;
        }

        $beeline_setting_subscription = array(
            'id_vats' => Vats::BEELINE,
            'variable' => 'subscription_id'
        );

        $id_vats_setting = current($this->vats_settings_model->search_one_table('id', $beeline_setting_subscription, 'id ASC', false, 0, true));

        $beeline_setting_subscription['name'] = 'API Идентификатор подписки xsi-events';
        $beeline_setting_subscription['value'] = $subscription_info['subscriptionId'];
        $save_subscription = (!empty($id_vats_setting))
            ? $this->vats_settings_model->edit($id_vats_setting, $beeline_setting_subscription)
            : $this->vats_settings_model->add($beeline_setting_subscription);

        if (empty($save_subscription)) {
            return false;
        }

        return $subscription_info['subscriptionId'];
    }


    /**
     * Проверка действия текущей подписки на события получения информации о звонках в реальном времени
     *
     * @access private
     * @return bool
     */
    private function _check_subscription ()
	{
        $beeline_setting_subscription = array(
            'id_vats' => Vats::BEELINE,
            'variable' => 'subscription_id',
        );

        $subscription = $this->vats_settings_model->search_one_table('id as id_setting, value as id_subscription', $beeline_setting_subscription, 'id ASC', false, 0, true);

        if (empty($subscription['id_subscription'])) {
            return false;
        }

        $check_subsription_result = $this->_build_request('service_subscription', array(
            'url_params' => array(
                'subscriptionId' => $subscription['id_subscription'],
            )
        ));

        if (empty($this->curl_info['http_code']) || $this->curl_info['http_code'] !== 200) {
            return false;
        }

        return true;
    }


    /**
     * Отказ от подписки на события получения информации о звонках в реальном времени
     *
     * @access private
     * @return bool
     */
    private function _unsubscribe_events ()
	{
        $beeline_setting_subscription = array(
            'id_vats' => Vats::BEELINE,
            'variable' => 'subscription_id',
        );

        $subscription = $this->vats_settings_model->search_one_table('id as id_setting, value as id_subscription', $beeline_setting_subscription, 'id ASC', false, 0, true);

        if (empty($subscription['id_subscription'])) {
            return false;
        }

        $subsription_result = $this->_build_request('service_subscription', array(
            'url_params' => array(
                'subscriptionId' => $subscription['id_subscription'],
            ),
            'delete' => true
        ));

        if (empty($this->curl_info['http_code']) || $this->curl_info['http_code'] !== 200) {
            return false;
        }

        return $this->vats_settings_model->edit($subscription['id_setting'], array('value' => ''));
    }


    /**
     * Подписка на события
     *
     * @access public
     * @throws Exception
     * @return json
     */
    public function ajax_subscribe_events()
	{
        try {
            if (!$this->user_model->checkLoggedUser()) {
                throw new Exception('NoAuthorisation', 1);
            }

            $url = site_url(strtolower(__CLASS__).'/event_call');

            $id_subscription = $this->_subscribe_events($url);

            if (empty($id_subscription)) {
                throw new Exception('При совершении подписки произошла ошибка', 2);
            }

            $response = array(
                'status'            => 0,
                'id_subscription'   => $id_subscription
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
     * Отписка от событий
     *
     * @access public
     * @throws Exception
     * @return json
     */
    public function ajax_unsubscribe_events()
	{
        try {
            if (!$this->user_model->checkLoggedUser()) {
                throw new Exception('NoAuthorisation', 1);
            }

            $is_unsubscribe = $this->_unsubscribe_events();

            if (empty($is_unsubscribe)) {
                throw new Exception('При отказе от подписки произошла ошибка', 2);
            }

            $response = array(
                'status' => 0,
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