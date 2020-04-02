/*
 * jquery.ajaxtabs
 *
 * Компонент управления закладками jQueryUI.tabs
 * Если потребуется использовать методы или события стандартного jQueryUI.tabs,
 * то можно обратиться к нему через тот же селектор, что и при инициализации ajaxtabs
 * (при этом инициализировать стандартный компонент tabs не нужно).
 *
 * Пример:
 * $('.ajaxtabs').ajaxtabs({buttonAdd: false});
 * $('.ajaxtabs').tabs('option', 'active', 1);
 *
 * Формат принимаемых плагином json данных по ajax:
 * [status]     статус выполнения запроса. Значение "0" - успешное выполнение
 * [content]    содержимое, html и иная информация, которая будет размещена во вкладке
 * [message]    сообщение, которое будет показано, в случае статуса отличного от "0"
 *
 *
 * @author Evgeny Bulgakov
 * @version 0.4
 *
 * name         ajaxtabs
 * type         jQuery
 * param        hash                        options
 * param        bool                        options[loadOnInit]                 загрузить ли активную вкладку сразу после инициализации
 * param        bool                        options[activateTabsAfterAdd]       сделать новую вкладку активной после добавления
 * param        string                      options[loadTabsOnActivate]         загрузка содержимого вкладок ('once'/'always')
 * param        bool                        options[rebuildTabTextAfterRefresh] переписывание заголовков закладок в процессе функции обновления
 * param        string                      options[reloadTabsAfterSave]        перезагрузка содержимого вкладок после сохранения данных
 * param        int                         options[active]                     индекс открытой вкладки (0, 1, 2, ...)
 * param        bool                        options[activeLast]                 активировать последнюю вкладку
 * param        string                      options[activeTabId]                идентификатор открытой вкладки (содержимое атрибута id="")
 * param        int                         options[activeAjaxTabId]            идентификатор ajaxtabs_id открытой вкладки
 * param        bool                        options[buttonAdd]                  отображение кнопки добавления
 * param        string                      options[buttonTextAdd]              текст кнопки добавления
 * param        string                      options[buttonTextSave]             текст кнопки сохранения
 * param        string                      options[buttonTextCancel]           текст кнопки отмены
 * param        string                      options[buttonTextRemove]           текст кнопки удаления
 * param        bool                        options[buttonSaveVisible]          отображение/скрытие кнопки сохранения
 * param        bool                        options[buttonAddVisible]           отображение/скрытие кнопки добавления
 * param        bool                        options[buttonCancelVisible]        отображение/скрытие кнопки отмена
 * param        bool                        options[buttonDeleteVisible]        отображение/скрытие кнопки удаления
 * param        bool                        options[buttonIcons]                иконки кнопок вместо надписей
 * param        bool                        options[buttonCssClear]             применять ли style="clear: both" при вставке кнопок
 * param        bool                        options[hideAddOnChangeTab]         скрывать закладку добавления при смене вкладки
 * param        bool                        options[showAllTabs]                отображать все вкладки
 * param        function                    options[afterLoad]                  событие срабатывающее после загрузки
 * param        function                    options[afterSave]                  событие срабатывающее после сохранения
 * param        function                    options[afterRemove]                событие срабатывающее после удаления
 *
 * tag_param    div{tabs} > ul > li > a     data-ajaxtabs_target_id             идентификатор данных ajaxtabs_id
 * tag_param    div{tabs} > ul > li > a     data-ajaxtabs_load_url              URL источник информации
 * tag_param    div{tabs} > ul > li > a     data-ajaxtabs_save_url              URL сохранения данных
 * tag_param    div{tabs} > ul > li > a     data-ajaxtabs_remove_url            URL удаления данных
 * tag_param    div{tabs} > ul > li > a     data-ajaxtabs_new_load_url          URL загрузки новой страницы
 * tag_param    div{tabs} > ul > li > a     data-ajaxtabs_new_save_url          URL сохранения новой страницы
 * tag_param    div{tabs} > ul > li > a     data-ajaxtabs_new_remove_url        URL удаления новой страницы
 * tag_param    div{tabs} > ul > li > a     data-ajaxtabs_loadOnActivate        ('once' / 'always') загрузка содержимого
 * tag_param    div(tabs) > ul > li > a     data-ajaxtabs_buttonSaveVisible     ('show' / 'hide') отображение кнопки сохранения
 * tag_param    div{tabs} > div             data-ajaxtabs_id                    идентификатор данных ajaxtabs_id
 *
 */
(function($) {

    var defaults = {
        activeLast:         undefined,
        activeTabId:        undefined,
        activeAjaxTabId:    undefined,
        buttonAdd:          true,
        buttonTextAdd:      'Добавить',
        buttonTextSave:     'Сохранить',
        buttonTextCancel:   'Отмена',
        buttonTextRemove:   'Удалить',
        buttonSaveVisible:  true,
        buttonAddVisible:   true,
        buttonCancelVisible: true,
        buttonDeleteVisible: true,
        buttonIcons:        false,
        buttonCssClear:     true,

        rebuildTabTextAfterRefresh: true,
        activateTabsAfterAdd: true,
        loadTabsOnActivate: 'once',
        reloadTabsAfterSave:true,
        loadOnInit:         true,
        clearTabOnAdd:      true,

        hideAddOnChangeTab: false,

        showAllTabs:        false,

        active:             0,
        disabled:           false,
        event:              'click',
        heightStyle:        'content',
        collapsible:        false,
        hide:               null,
        show:               null,
        loadIndicator:      null,//"Загрузка",
        loadAsync:          false,
        loadOverlay:        false,
        afterLoad:          undefined,
        afterSave:          undefined,
        afterRemove:        undefined
    };

    var private_methods = {
        getFormData: function (fields_selector) {
            if (!fields_selector) {
                return false;
            }

            var form_data = new FormData();

            fields_selector.each(function(){
                var field_name = false;
                var field_value = false;

                // Если поле является мультиселектным, то происходит добавление каждого значения к formData
                if ($(this).hasClass('multiselect') || $(this).attr('multiselect') == 'multiselect') {
                    var selected_values = $(this).val();
                    if (!selected_values) {
                        form_data.append($(this).prop('name'), false);
                    }
                    else {
                        for (i in selected_values) {
                            form_data.append($(this).prop('name'), selected_values[i]);
                        }
                    }
                }
                else if ($(this).is(':checkbox')) {
                    field_name = $(this).prop('name');
                    field_value = ($(this).is(':checked')) ? $(this).val() : 0;
                }
                else if ($(this).is(':radio')) {
                    field_name = ($(this).is(':checked')) ? $(this).prop('name') : false;
                    field_value = ($(this).is(':checked')) ? $(this).val() : false;
                }
                // Если поле не является ничем из вышеперечисленного и не является файлом, то...
                else if (!$(this).is(':file')) {
                    field_name = $(this).prop('name');
                    field_value = $(this).val();
                }

                // Запись поля в formData
                if (field_name !== false && field_value !== false) {
                    form_data.append(field_name, field_value);
                }
            });

            // Добавление файловых полей к formData
            fields_selector.filter(':file').each(function(i, obj){
                var name = $(this).attr('name');
                $.each(obj.files, function(j, file){
                    form_data.append(name, file);
                });
            });

            return form_data;
        }
    };

    var methods = {
        // Инициализация плагина
        init:function(params) {
            var options = $.extend({}, defaults, params);

            return this.each(function(){

                var $this = $(this);
                var data = $this.data('ajaxtabs');

                if (data === undefined) {

                    var ajaxtabs = {
                        options: options,
                        ajaxtab_id: {},
                        tab_index: {},
                        tab_params: {}
                    };

                    var lastActiveIndex = 0;

                    // Сбор информации обрабатываемого объекта
                    $this.find('> ul > li > a').each(function(index){
                        var tab_link = $(this);
                        var target_id = tab_link.attr('data-ajaxtabs_target_id');
                        ajaxtabs['ajaxtab_id'][index] = target_id;
                        ajaxtabs['tab_index'][target_id] = index;
                        ajaxtabs['tab_params'][target_id] = {
                            load: tab_link.attr('data-ajaxtabs_load_url'),
                            save: tab_link.attr('data-ajaxtabs_save_url'),
                            remove: tab_link.attr('data-ajaxtabs_remove_url'),
                            new_load: tab_link.attr('data-ajaxtabs_new_load_url'),
                            new_save: tab_link.attr('data-ajaxtabs_new_save_url'),
                            new_remove: tab_link.attr('data-ajaxtabs_new_remove_url'),
                            loadOnActivate: tab_link.attr('data-ajaxtabs_loadOnActivate'),
                            buttonSaveVisible: tab_link.attr('data-ajaxtabs_buttonSaveVisible')
                        };
                        if (lastActiveIndex < index && target_id != 0) {
                            lastActiveIndex = index;
                        }
                    });

                    var ajaxtabs_id_from_tab_id = (options['activeTabId'] !== undefined)
                        ? $this.find(options['activeTabId']).attr('data-ajaxtabs_id')
                        : '';

                    // Определение активной вкладки
                    var active_ajaxtab_id = (options['activeLast'] === true)
                        ? ajaxtabs['ajaxtab_id'][lastActiveIndex]
                        : ( (options['activeTabId'] !== undefined && ajaxtabs['tab_params'][ajaxtabs_id_from_tab_id] !== undefined)

                            ? ajaxtabs_id_from_tab_id
                            : ( (options['activeAjaxTabId'] !== undefined && ajaxtabs['tab_params'][options['activeAjaxTabId']] !== undefined)

                                ? options['activeAjaxTabId']
                                : ajaxtabs['ajaxtab_id'][options['active']] ));

                    var active_index = ajaxtabs['tab_index'][active_ajaxtab_id];

                    // Инициализация jQuery.tabs
                    $this.tabs({
                        active:         active_index,
                        disabled:       options['disabled'],
                        event:          options['event'],
                        heightStyle:    options['heightStyle'],
                        collapsible:    options['collapsible'],
                        hide:           options['hide'],
                        show:           options['show'],
                        activate: function( event, ui ) {
                            if (options['showAllTabs']) {
                                ui.oldPanel.show();
                            }
                            var updated_data = $this.data('ajaxtabs');
                            var target_id = ui.newTab.children('a').attr('data-ajaxtabs_target_id');
                            if (options['showAllTabs'] || (target_id == 0 && options['clearTabOnAdd'])) {
                                $this.find('> div[data-ajaxtabs_id="0"]').find('input:text, input:file, textarea, select').val('');
                                $this.find('> div[data-ajaxtabs_id="0"]').find('.select2-hidden-accessible').select2('destroy').select2();
                            }
                            if (target_id != 0 && options['hideAddOnChangeTab']) {
                                $this.find('> ul > li > a[data-ajaxtabs_target_id="0"]').parent().hide();
                            }
                            if (updated_data['ajaxtabs']['tab_params'][target_id]['load'] !== undefined) {
                                if (!ui.newPanel.html().trim() || options['loadTabsOnActivate'] == 'always' || updated_data['ajaxtabs']['tab_params'][target_id]['loadOnActivate'] == 'always') {
                                    methods.load.apply($this, [{ 
                                        url: updated_data['ajaxtabs']['tab_params'][target_id]['load'],
                                        afterLoad: options['afterLoad']
                                    }]);
                                }
                            }
                        }
                    });

                    if (options['showAllTabs']) {
                        $this.find('> div').show();
                    }

                    var div_clear = '<div style="clear: both;"></div>';
                    var is_show_save_button = options['buttonSaveVisible'] && ajaxtabs['tab_params'][0]['buttonSaveVisible'] != 'hide';

                    var btn_save = (options['buttonIcons'])
                        ? '<span class="ajaxtab_save" ' + (!is_show_save_button ? 'style="display: none;"' : '') + '><a title="' + options['buttonTextSave'] + '" class="ui-icon ui-icon-disk pointer"></a></span>'
                        : '<input class="ajaxtab_save" value="' + options['buttonTextSave'] + '" type="button" ' + (!is_show_save_button ? 'style="display: none;"' : '') + ' />';
                    var btn_cancel = (options['buttonIcons'])
                        ? '<span class="ajaxtab_cancel" ' + (!options['buttonCancelVisible'] ? 'style="display: none;"' : '') + '><a title="' + options['buttonTextCancel'] + '" class="ui-icon ui-icon-arrowreturnthick-1-w pointer"></a></span>'
                        : '<input class="ajaxtab_cancel" value="' + options['buttonTextCancel'] + '" type="button" ' + (!options['buttonCancelVisible'] ? 'style="display: none;"' : '') + ' />';
                    var btn_remove = (options['buttonIcons'])
                        ? '<span class="ajaxtab_remove" ' + (!options['buttonDeleteVisible'] ? 'style="display: none;"' : '') + '><a title="' + options['buttonTextRemove'] + '" class="ui-icon ui-icon-trash pointer"></a></span>'
                        : '<input class="ajaxtab_remove" value="' + options['buttonTextRemove'] + '" ' + (!options['buttonDeleteVisible'] ? 'style="display: none;"' : '') + ' type="button" />';

                    if (options['showAllTabs']) {
                        $this.find('> div[data-ajaxtabs_id!="0"]').each(function(){
                            var tab = $(this);
                            var ajaxtab_id = tab.attr('data-ajaxtabs_id');
                            
                            var insert_btn_save = (ajaxtabs['tab_params'][ajaxtab_id]['save'] !== undefined) ? btn_save : '';
                            var insert_btn_remove = (ajaxtabs['tab_params'][ajaxtab_id]['remove'] !== undefined) ? btn_remove : '';
                            var insert_div_clear = (options['buttonCssClear']) ? div_clear : '';

                            tab.append(insert_div_clear + '<div class="ajaxtab_buttons">' + insert_btn_remove + insert_btn_save + insert_div_clear + '</div>');

                            // Размещение и обработка события нажатия кнопки сохранения
                            if (ajaxtabs['tab_params'][ajaxtab_id]['save'] !== undefined) {
                                tab.find('> div.ajaxtab_buttons .ajaxtab_save').button().bind('click.ajaxtabs', function(){
                                    var updated_data = $this.data('ajaxtabs');
                                    methods.save.apply($this, [{
                                        url: updated_data['ajaxtabs']['tab_params'][ajaxtab_id]['save'], 
                                        ajaxtab_id: ajaxtab_id,
                                        afterSave: options['afterSave']
                                    }]);
                                });
                            }

                            // Размещение и обработка события нажатия кнопки удаления
                            if (ajaxtabs['tab_params'][ajaxtab_id]['remove'] !== undefined) {
                                tab.find('> div.ajaxtab_buttons .ajaxtab_remove').button().bind('click.ajaxtabs', function(){
                                    var updated_data = $this.data('ajaxtabs');
                                    D.show_confirm('Удалить версию?', function(){
                                        methods.remove.apply($this, [{ 
                                            url: updated_data['ajaxtabs']['tab_params'][ajaxtab_id]['remove'], 
                                            ajaxtab_id: ajaxtab_id,
                                            afterRemove: options['afterRemove']
                                        }]);
                                    });
                                });
                            }
                        });
                    }
                    var tab_add = $this.find('> div[data-ajaxtabs_id="0"]');

                    var insert_btn_save = (ajaxtabs['tab_params'][0]['save'] !== undefined) ? btn_save : '';
                    var insert_btn_cancel = btn_cancel;
                    var insert_div_clear = (options['buttonCssClear']) ? div_clear : '';

                    tab_add.append(insert_div_clear + '<div class="ajaxtab_buttons">' + insert_btn_cancel + insert_btn_save + insert_div_clear + '</div>');

                    // Размещение и обработка события нажатия кнопки сохранения
                    if (ajaxtabs['tab_params'][0]['save'] !== undefined) {
                        tab_add.find('> div.ajaxtab_buttons .ajaxtab_save').button().bind('click.ajaxtabs', function(){
                            var updated_data = $this.data('ajaxtabs');
                            methods.save.apply($this, [{
                                url: updated_data['ajaxtabs']['tab_params'][0]['save'], 
                                ajaxtab_id: 0,
                                afterSave: options['afterSave']
                            }]);
                        });
                    }

                    // Размещение и обработка события нажатия кнопки отмены
                    tab_add.find('> div.ajaxtab_buttons .ajaxtab_cancel').button().bind('click.ajaxtabs', function(){
                        var updated_data = $this.data('ajaxtabs');
                        var last_ajaxtab_id = $this.find('> div:last').attr('data-ajaxtabs_id');
                        $this.tabs({
                            active: updated_data['ajaxtabs']['tab_index'][last_ajaxtab_id]
                        });
                    });

                    $this.find('> ul > li > a:last').addClass('ajaxtab_add');
                    // Если включена возможность добавления => обработка закладки добавления
                    if (options['buttonAdd']) {
                        var btn_add = '<input class="ajaxtab_add" value="' + options['buttonTextAdd'] + '" ' + (!options['buttonAddVisible'] ? 'style="display: none;"' : '') + ' type="button" />';

                        $this.find('> ul').append(btn_add);

                        // Размещение и обработка события нажатия кнопки добавления
                        $this.find('> ul > input.ajaxtab_add').button().bind('click.ajaxtabs', function(){
                            var updated_data = $this.data('ajaxtabs');
                            tab_add.find('input:text, input:file, textarea, select').val('');
                            tab_add.find('.select2-hidden-accessible').select2('destroy').select2();
                            $this.find('> ul > li > a[data-ajaxtabs_target_id="0"]').parent().show();
                            $this.tabs({
                                active: updated_data['ajaxtabs']['tab_index'][0]
                            });
                        });

                        tab_add.append(div_clear);
                    }

                    // Сохранение информации объекта в jQuery.data. Фактическое завершение инициализации плагина
                    $this.data('ajaxtabs', {
                        target : $this,
                        ajaxtabs : ajaxtabs
                    });

                    if (options['loadOnInit'] === true && options['showAllTabs'] === false) {
                        // Если во вкладке предусмотрена загрузка данных => загрузить активную вкладку
                        if (ajaxtabs['tab_params'][active_ajaxtab_id]['load'] !== undefined) {
                            methods.load.apply($this, [{
                                url: ajaxtabs['tab_params'][active_ajaxtab_id]['load'],
                                dialogs: false,
                                afterLoad: options['afterLoad']
                            }]);
                        }
                    }
                }
            });
        },
        destroy:function() {
            return this.each(function(){
                var $this = $(this);
                $this.tabs('destroy');
                $this.unbind('.ajaxtabs');
                $this.removeData('ajaxtabs');
            });
        },
        // Загрузка информации во вкладку
        load:function(settings) {
            var available_settings = {
                url:            undefined,
                tab_id:         undefined,
                tab_index:      undefined,
                ajaxtab_id:     undefined,
                onLoadActivate: undefined,
                send_data:      {},
                afterLoad:      undefined
            };
            var options = $.extend(available_settings, settings);
            return this.each(function(){
                var $this = $(this);
                var data = $this.data('ajaxtabs');

                if (data === undefined) {
                    $.error( 'Плагин jQuery.ajaxtabs не инициализирован' );
                }
                options = $.extend(options, data.ajaxtabs.options);
                // Определение вкладки
                var ajaxtab_id = (options['tab_id'] !== undefined)
                    ? $this.find(options['tab_id']).attr('data-ajaxtabs_id')
                    : ( (options['ajaxtab_id'] !== undefined)
                        ? options['ajaxtab_id']
                        : ( (options['tab_index'] !== undefined)
                            ? data['ajaxtabs']['ajaxtab_id'][options['tab_index']]
                            : data['ajaxtabs']['ajaxtab_id'][$this.tabs('option', 'active')] ));

                var tab_id = (options['tab_id'] !== undefined)
                    ? options['tab_id']
                    : '#' + $this.find('> div[data-ajaxtabs_id="' + ajaxtab_id + '"]').attr('id');

                if (options['dialogs'] == true) {
                    D.show_waiting('Загрузка информации');
                }

                if(options.loadAsync === true && options.loadIndicator !== null){
                    $(tab_id).html(options.loadIndicator);
                }

                if(options.loadOverlay === true){
                    $(tab_id).append('<div class="ajaxabs_content_load_wrapper"><div><img src="/img/indicator.gif"/></div></div>');
                }
                $(tab_id).addClass('ajaxabs_content_loading');

                $.ajax({
                    type: 'POST',
                    url: ((options['url'] !== undefined) ? options['url'] : data['ajaxtabs']['tab_params'][ajaxtab_id]['load']),
                    data: options['send_data'],
                    async: options.loadAsync,
                    dataType: 'json',
                    success:  function(result) {
                        if (result.status == 0) {
                            var div_clear = '<div style="clear: both;"></div>';
                            var is_show_save_button = data['ajaxtabs']['options']['buttonSaveVisible'] && data['ajaxtabs']['tab_params'][ajaxtab_id]['buttonSaveVisible'] != 'hide';
                            var btn_save = (data['ajaxtabs']['options']['buttonIcons'])
                                ? '<span class="ajaxtab_save" ' + (!is_show_save_button ? 'style="display: none;"' : '') + '><a title="' + data['ajaxtabs']['options']['buttonTextSave'] + '" class="ui-icon ui-icon-disk pointer"></a></span>'
                                : '<input class="ajaxtab_save" value="' + data['ajaxtabs']['options']['buttonTextSave'] + '" ' + (!is_show_save_button ? 'style="display: none;"' : '') + ' type="button" />';

                            var btn_remove = (data['ajaxtabs']['options']['buttonIcons'])
                                ? '<span class="ajaxtab_remove" ' + (!data['ajaxtabs']['options']['buttonDeleteVisible'] ? 'style="display: none;"' : '') + '><a title="' + data['ajaxtabs']['options']['buttonTextRemove'] + '" class="ui-icon ui-icon-trash pointer"></a></span>'
                                : '<input class="ajaxtab_remove" value="' + data['ajaxtabs']['options']['buttonTextRemove'] + '" ' + (!data['ajaxtabs']['options']['buttonDeleteVisible'] ? 'style="display: none;"' : '') + ' type="button" />';
//                            var t0 = new Date().getTime();

                            $(tab_id).html(result.content);

                            $(function(){
                                $(tab_id).removeClass('ajaxabs_content_loading');
                            });

//                            console.log("ajaxtabs: timediff", ajaxtab_id, new Date().getTime() - t0);

                            var insert_btn_save = (data['ajaxtabs']['tab_params'][ajaxtab_id]['save'] !== undefined) ? btn_save : '';
                            var insert_btn_remove = (data['ajaxtabs']['tab_params'][ajaxtab_id]['remove'] !== undefined) ? btn_remove : '';
                            var insert_div_clear = (data['ajaxtabs']['options']['buttonCssClear']) ? div_clear : '';

                            $(tab_id).append(insert_div_clear + '<div class="ajaxtab_buttons">' + insert_btn_remove + insert_btn_save + insert_div_clear + '</div>');

                            // Размещение и обработка события нажатия кнопки сохранения
                            if (data['ajaxtabs']['tab_params'][ajaxtab_id]['save'] !== undefined) {
                                $(tab_id).find('> div.ajaxtab_buttons .ajaxtab_save').button().bind('click.ajaxtabs', function(){
                                    var updated_data = $this.data('ajaxtabs');
                                    methods.save.apply($this, [{
                                        url: updated_data['ajaxtabs']['tab_params'][ajaxtab_id]['save'], 
                                        ajaxtab_id: ajaxtab_id,
                                        afterSave: data['ajaxtabs']['options']['afterSave']
                                    }]);
                                });
                            }

                            // Размещение и обработка события нажатия кнопки удаления
                            if (data['ajaxtabs']['tab_params'][ajaxtab_id]['remove'] !== undefined) {
                                $(tab_id).find('> div.ajaxtab_buttons .ajaxtab_remove').button().bind('click.ajaxtabs', function(){
                                    var updated_data = $this.data('ajaxtabs');
                                    D.show_confirm('Удалить версию?', function(){
                                        methods.remove.apply($this, [{ 
                                            url: updated_data['ajaxtabs']['tab_params'][ajaxtab_id]['remove'], 
                                            ajaxtab_id: ajaxtab_id,
                                            afterRemove: data['ajaxtabs']['options']['afterRemove']
                                        }]);
                                    });
                                });
                            }

                            if (options['onLoadActivate'] == true) {
                                $this.tabs('option', 'active', data['ajaxtabs']['tab_index'][ajaxtab_id]);
                            }
                        }
                        else {
                            D.show_error(result.message);
                        }
                        if (options['dialogs'] == true) {
                            D.hide_waiting();
                        }
                        if (typeof options['afterLoad'] === 'function') {
                            options['afterLoad']($this);
                        }
                    }
                });

            });
        },
        refresh:function() {
            return this.each(function(){
                var $this = $(this);
                var data = $this.data('ajaxtabs');

                if (data === undefined) {
                    $.error( 'Плагин jQuery.ajaxtabs не инициализирован' );
                }

                var ajaxtabs = {
                    options: data['ajaxtabs']['options'],
                    ajaxtab_id: {},
                    tab_index: {},
                    tab_params: {}
                };

                $this.find('> ul > li > a').each(function(index){
                    var tab_link = $(this);
                    var target_id = tab_link.attr('data-ajaxtabs_target_id');
                    if ((target_id != 0) && ($this.attr('id') != "fl_job_patent_payments") && ajaxtabs['options']['rebuildTabTextAfterRefresh'] == true) {
                        tab_link.text(index + 1);
                    }
                    ajaxtabs['ajaxtab_id'][index] = target_id;
                    ajaxtabs['tab_index'][target_id] = index;
                    ajaxtabs['tab_params'][target_id] = {
                        load: tab_link.attr('data-ajaxtabs_load_url'),
                        save: tab_link.attr('data-ajaxtabs_save_url'),
                        remove: tab_link.attr('data-ajaxtabs_remove_url'),
                        new_load: tab_link.attr('data-ajaxtabs_new_load_url'),
                        new_save: tab_link.attr('data-ajaxtabs_new_save_url'),
                        new_remove: tab_link.attr('data-ajaxtabs_new_remove_url'),
                        loadOnActivate: tab_link.attr('data-ajaxtabs_loadOnActivate')
                    };
                });

                $this.tabs( "refresh" );

                if (ajaxtabs['options']['showAllTabs']) {
                    $this.find('> div').show();
                }

                $this.data('ajaxtabs', {
                    target : $this,
                    ajaxtabs : ajaxtabs
                });
            });
        },
        save:function(settings) {
            var available_settings = {
                url:            undefined,
                dialogs:        true,
                tab_id:         undefined,
                tab_index:      undefined,
                ajaxtab_id:     undefined,
                send_data:      {black: false, strong: true},
                afterSave:      undefined
            };
            var receive_ajaxtab_id_indexes = [
                'id',
                'id_revision',
                'id_rev',
                'id_version',
                'revision',
                'version'
            ];
            var options = $.extend(available_settings, settings);
            return this.each(function(){
                var $this = $(this);
                var data = $this.data('ajaxtabs');

                if (data === undefined) {
                    $.error( 'Плагин jQuery.ajaxtabs не инициализирован' );
                }

                // Определение вкладки
                var ajaxtab_id = (options['tab_id'] !== undefined)
                    ? $this.find(options['tab_id']).attr('data-ajaxtabs_id')
                    : ( (options['ajaxtab_id'] !== undefined)
                        ? options['ajaxtab_id']
                        : ( (options['tab_index'] !== undefined)
                            ? data['ajaxtabs']['ajaxtab_id'][options['tab_index']]
                            : data['ajaxtabs']['ajaxtab_id'][$this.tabs('option', 'active')] ));

                var tab_id = (options['tab_id'] !== undefined)
                    ? options['tab_id']
                    : '#' + $this.find('> div[data-ajaxtabs_id="' + ajaxtab_id + '"]').attr('id');

                /*
                var send_data_fields = ($(tab_id + ' .ajaxtab_save').length > 1)
                    ? [ tab_id + ':visible input', tab_id + ':visible select', tab_id + ':visible textarea' ]
                    : [ tab_id + ' input', tab_id + ' select', tab_id + ' textarea' ];
                */

                var is_dialog_content = ($(tab_id).parents('.ui-dialog').length > 0) ? true : false;
                var dialog_selector = (is_dialog_content) ? '.ui-dialog ' : '';

                var visible_filter = ($(tab_id + ' .ajaxtab_save').length > 1 && !is_dialog_content) ? ':visible' : '';
                $(tab_id + visible_filter + ' .ajaxtabs').find('input, select, textarea').attr('data-ajaxtabs_skip_data', 1);
                var send_data_fields = $(dialog_selector + tab_id + visible_filter).find('input, select, textarea').not('[data-ajaxtabs_skip_data="1"]');
                $(tab_id + visible_filter + ' .ajaxtabs').find('input, select, textarea').removeAttr('data-ajaxtabs_skip_data');

                //var form_data = private_methods.getFormData.apply($this, [ send_data_fields.join(', ') ]);
                var form_data = private_methods.getFormData.apply($this, [ send_data_fields ]);

                for (var i in options['send_data']) {
                    form_data.append(i, options['send_data'][i]);
                }

                if (options['dialogs'] == true) {
                    $('#waiting_dialog').dialog('option', 'title', 'Загрузка информации');
                    $('#waiting_dialog').dialog('open');
                }
                $.ajax({
                    url: ((options['url'] !== undefined) ? options['url'] : data['ajaxtabs']['tab_params'][ajaxtab_id]['save']),
                    data: form_data,
                    processData: false,
                    contentType: false,
                    async: false,
                    type:'POST',
                    dataType:'json',
                    success: function(result) {
                        if (result.status == 0){
                            // Если вкладка предназначена для внесения новых версий => создать вкладку
                            if (ajaxtab_id == 0) {
                                for (var i in receive_ajaxtab_id_indexes) {
                                    if (result[receive_ajaxtab_id_indexes[i]] !== undefined) {
                                        ajaxtab_id = result[receive_ajaxtab_id_indexes[i]];
                                    }
                                }
                                if (ajaxtab_id != 0) {
                                    // Добавление новой вкладки в компонент tabs jQuery UI
                                    var new_tab_id = $this.find('> div:first').attr('id') + ajaxtab_id ;
                                    var tab_link = '<li>';
                                    tab_link += '<a href="#' + new_tab_id + '" data-ajaxtabs_target_id="' + ajaxtab_id + '"';
                                    if (data['ajaxtabs']['tab_params'][0]['new_load'] !== undefined) {
                                        tab_link += ' data-ajaxtabs_load_url="' + data['ajaxtabs']['tab_params'][0]['new_load'] + ajaxtab_id + '"';
                                    }
                                    if (data['ajaxtabs']['tab_params'][0]['new_save'] !== undefined) {
                                        tab_link += ' data-ajaxtabs_save_url="' + data['ajaxtabs']['tab_params'][0]['new_save'] + ajaxtab_id + '"';
                                    }
                                    if (data['ajaxtabs']['tab_params'][0]['new_remove'] !== undefined) {
                                        tab_link += ' data-ajaxtabs_remove_url="' + data['ajaxtabs']['tab_params'][0]['new_remove'] + ajaxtab_id + '"';
                                    }
                                    tab_link += '">';
                                    tab_link += $this.find('> ul > li > a[data-ajaxtabs_target_id][data-ajaxtabs_load_url]').length + 1;
                                    tab_link += '</a></li>';
                                    $this.find('> ul > li > a[data-ajaxtabs_target_id="0"]').parent().before(tab_link);

                                    var tab = '<div id="' + new_tab_id + '" data-ajaxtabs_id="' + ajaxtab_id + '"></div>';

                                    if ($this.find('> div[data-ajaxtabs_id="0"]').length > 0) {
                                        $this.find('> div[data-ajaxtabs_id="0"]').before(tab);
                                    }
                                    else {
                                        $this.append(tab);
                                    }

                                    methods.refresh.apply($this);
                                    data = $this.data('ajaxtabs');

                                    if (data['ajaxtabs']['options']['activateTabsAfterAdd']) {
                                        $this.tabs({
                                            active: data['ajaxtabs']['tab_index'][ajaxtab_id]
                                        });
                                    }
                                }
                                else if (options['dialogs'] == true) {
                                    var error = 'Не получен идентификатор созданной записи.';
                                    $('#error_dialog').html('<p>' + error + '<br />' + receive_ajaxtab_id_indexes.join(', ') +'</p>');
                                    $('#error_dialog').dialog('open');
                                }
                            }
                            // Если не вкладка добавления и предусмотрена загрузка данных => перезагрузить сохранённую вкладку
                            else if (data['ajaxtabs']['tab_params'][ajaxtab_id]['load'] !== undefined && data['ajaxtabs']['options']['reloadTabsAfterSave']) {
                                methods.load.apply($this, [{
                                    url: data['ajaxtabs']['tab_params'][ajaxtab_id]['load'],
                                    dialogs: false,
                                    ajaxtab_id : ajaxtab_id,
                                    afterLoad: data['ajaxtabs']['options']['afterLoad']
                                }]);
                            }
                            $this.trigger('ajaxtabs_save', $this, result);

                            if (options['dialogs'] == true) {
                                D.show_pop_message('Изменения успешно сохранены');
                            }
                        }
                        else if (options['dialogs'] == true) {
                            $('#error_dialog').html('<p>' + result.message +'</p>');
                            $('#error_dialog').dialog('open');
                        }
                        if (options['dialogs'] == true) {
                            $('#waiting_dialog').dialog('close');
                        }
                        if (typeof options['afterSave'] === 'function') {
                            options['afterSave']($this);
                        }
                    }
                });
            });
        },
        remove:function(settings) {
            var available_settings = {
                url:            undefined,
                dialogs:        true,
                tab_id:         undefined,
                tab_index:      undefined,
                ajaxtab_id:     undefined,
                send_data:      {black: false, strong: true},
                afterRemove:    undefined
            };
            var options = $.extend(available_settings, settings);
            return this.each(function(){
                var $this = $(this);
                var data = $this.data('ajaxtabs');

                if (data === undefined) {
                    $.error( 'Плагин jQuery.ajaxtabs не инициализирован' );
                }

                // Определение вкладки
                var ajaxtab_id = (options['tab_id'] !== undefined)
                    ? $this.find(options['tab_id']).attr('data-ajaxtabs_id')
                    : ( (options['ajaxtab_id'] !== undefined)
                        ? options['ajaxtab_id']
                        : ( (options['tab_index'] !== undefined)
                            ? data['ajaxtabs']['ajaxtab_id'][options['tab_index']]
                            : data['ajaxtabs']['ajaxtab_id'][$this.tabs('option', 'active')] ));

                var tab_id = (options['tab_id'] !== undefined)
                    ? options['tab_id']
                    : '#' + $this.find('> div[data-ajaxtabs_id="' + ajaxtab_id + '"]').attr('id');

                if (options['dialogs'] == true) {
                    $('#waiting_dialog').dialog('option', 'title', 'Загрузка информации');
                    $('#waiting_dialog').dialog('open');
                }

                $.ajax({
                    url: ((options['url'] !== undefined) ? options['url'] : data['ajaxtabs']['tab_params'][ajaxtab_id]['remove']),
                    type:'POST',
                    async: false,
                    dataType:'json',
                    success: function(result) {
                        if (result.status == 0){
                            $(tab_id).remove();
                            $this.find('> ul > li > a[data-ajaxtabs_target_id="' + ajaxtab_id + '"]').parent().remove();
                            methods.refresh.apply($this);
                            $this.trigger('ajaxtabs_remove', $this, result);
                        }
                        else  if (options['dialogs'] == true) {
                            D.show_error(result.message);
                        }
                        if (options['dialogs'] == true) {
                            $('#waiting_dialog').dialog('close');
                        }
                        if (typeof options['afterRemove'] === 'function') {
                            options['afterRemove']($this);
                        }
                    }
                });
            });
        },
        updateVerticalTabHeight: function() {
            return this.each(function(){
                var $this = $(this);
                var data = $this.data('ajaxtabs');

                if (data === undefined) {
                    $.error( 'Плагин jQuery.ajaxtabs не инициализирован' );
                }

                $this.find('> ul > li > a').each(function(index){
                    var tab_link = $(this);
                    var target_id = tab_link.attr('data-ajaxtabs_target_id');
                    var content = $this.find('> div[data-ajaxtabs_id="' + target_id + '"]');
                    tab_link.parent().css('margin-bottom', content[0].clientHeight - this.offsetHeight + 2);
                });

            });
        }
    };

    $.fn.ajaxtabs = function(method){
        if ( methods[method] ) {
            return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
        }
        else if ( typeof method === 'object' || ! method ) {
            return methods.init.apply( this, arguments );
        }
        else {
            $.error( 'Метод "' +  method + '" не найден в плагине jQuery.ajaxtabs' );
        }
    };
})(jQuery);