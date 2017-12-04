/*eslint no-undef: "off"*/
define(['jquery'], function($){
    var CustomWidget = function (){

        let self = this,
            system = self.system(),
            send_data = {};
        ;

        const API_BASE = 'https://api.kiiiosk.ru/v1/amocrm';

        const GET_X_API_KEY_URL = 'https://app.kiiiosk.ru/profile/access_keys';

        let AmoApi = {
            current: false,
            error: function (header, text) {
                AMOCRM.notifications.show_message_error({
                    text: text,
                    header: '<b class="widget_header__description_h">' + header + '</b>'
                });
            },
            getCurrent: function () {
                if(this.current) {
                    return current;
                }
                return new Promise(function(resolve){
                    $.get("/private/api/v2/json/accounts/current").then(function(r){
                        AmoApi.current = r;
                        resolve(r);
                    })
                });
            },
            getFieldFromCFByName: function (cf, field_name) {
                if (_.isEmpty(cf)) {
                    return false;
                }

                let needField = cf.filter((field) => {
                    return field.name === field_name;
                });

                if (_.isEmpty(needField)) {
                    return false;
                }

                return needField[0].values[0].value;
            },
            getUserOptions: function()  {
                return new Promise(function (resolve) {
                    AmoApi.getCurrent().then(function (data) {
                        let userOptions = '';

                        data.response.account.users.forEach(function (user) {
                            userOptions += `<option value="${user.id}">${user.name}</option>`;
                        });

                        resolve(userOptions);
                    });
                });
            },
            getPipelineOptions: function(){
                return new Promise(function (resolve) {
                    AmoApi.getCurrent().then(function (data) {
                        let pipelineOptions = _.map(data.response.account.pipelines, function (pipeline, pipeline_id) {
                            return `<option value="${pipeline_id}">${pipeline.name}</option>`;
                        }).join("\n");

                        resolve(pipelineOptions);
                    });
                });
            },
            getCatalogList: function(catalog_name){
                return $.get('/private/api/v2/json/catalogs/list');
            }
        };

        /**
         * Проверка области запуска виджета - в настройках виджета?
         * @return {boolean}        true
         */
        this.isInSettings = function () {
            return (self.system().area == 'settings');
        }

        function addStyle() {
            var widgetStyleCssFile = `${self.params.path}/style.css`;
            if (!$(`[href="${widgetStyleCssFile}"]`).length) {
                var widgetStyle = `<link rel="stylesheet" href="${widgetStyleCssFile}" type="text/css" />`;
                $('body').append(widgetStyle);
            }
        }

        /**
         * @return {Object} Promise
         */
        function loadData() {
            return new Promise((resolve, reject)=>{
                $.get(widget_url).then((data) =>{
                    if( !_.isObject(data) || !_.has(data, 'diagnosis') ) {
                        throw new TypeError("Ожидается объект, а возвращает " + typeof data);
                    }

                    let diagnosisItems = data.diagnosis.map((diagnosisName) => {
                        return `<li class="diagnosis__item">${diagnosisName}</li>`;
                    }).join("\n");

                    emailEnds = data.email_autocomplete;

                    diagnosisListWrap = `<div class="diagnosis_wrap " style="display:none"><ul>${diagnosisItems}</ul></div>`;
                    resolve(data);
                });
            });
        }

        /**
         * Калбеки виджета
         */
        this.callbacks = {
            render: function(){
                return self.isInSettings();
            },
            /**
             * Инициализация
             */
            init: function() {
                system = self.system();
                user = AMOCRM.constant('user');
                account = AMOCRM.constant('account');
                console.log('inited');
                addStyle();
                return true;
            },
            /**
             * Вызывается вместе с init
             */
            bind_actions: function(){
                return true;
            },
            /**
             * Вызывается при открытие виджета
             */
            settings: function(){
                try{
                    /* X_API_KEY add link */
                    let apiKeyInput = $('input[name="api_key"]');
                    let apiKeyLink = `<a href="${GET_X_API_KEY_URL}" class="kiosk_api_key_link" target="_blank">Получить api key</a>`;
                    apiKeyInput.closest('.widget_settings_block__item_field')
                        .find('.widget_settings_block__title_field')
                        .append(apiKeyLink);

                    /* Список товаров selectable */
                    let goodsCatalogInput = $('input[name="goods_catalog_id"]');

                    let catalogs = [{
                        option: 'Не выбран',
                        id: 0
                    }];

                    AmoApi.getCatalogList().then((r)=>{
                        _.each(r.response.catalogs, function(catalog, catalog_id) {
                            catalogs.push({
                                option: catalog.name,
                                id: catalog_id
                            });
                        });

                        var goods_catalogs_select_html = self.render({ref: '/tmpl/controls/select.twig'}, {
                            id: 'kiosk_goods_catalog_statuses_select',
                            class_name: 'kiosk_goods_catalog_statuses_select',
                            items: catalogs,
                            selected: goodsCatalogInput.val()
                        });

                        goodsCatalogInput.hide().closest('.widget_settings_block__input_field').append(goods_catalogs_select_html);

                        var goodsCatalogHiddenInput = $('#kiosk_goods_catalog_statuses_select');
                        goodsCatalogHiddenInput.parents('.kiosk_goods_catalog_statuses_select').css({width: '396px', 'margin': '5px 0 0 0'});

                        goodsCatalogHiddenInput.on('change', function() {
                            goodsCatalogInput.val($(this).val()).trigger('controls:change:visual');;
                        });
                    });

                    /* initial_state_id in API  */
                    let defaultStatusInput = $('input[name="status_id_default"]');

                    /*  paid_state_id in API - */
                    let payStatusInput = $('input[name="status_id_pay"]');

                    let leadStatuses = [{
                        option: 'Не выбран',
                        id: 0,
                    }];


                    AmoApi.getCurrent().then( (r) => {
                        r.response.account.leads_statuses.forEach(function(status){
                            leadStatuses.push({
                                option: status.name,
                                id: status.id
                            });
                        });

                        var default_statuses_select_html = self.render({ref: '/tmpl/controls/select.twig'}, {
                            id: 'kiosk_default_statuses_select',
                            class_name: 'kiosk_default_statuses_select',
                            items: leadStatuses,
                            selected: defaultStatusInput.val()
                        });

                        var pay_statuses_select_html = self.render({ref: '/tmpl/controls/select.twig'}, {
                            id: 'kiosk_pay_statuses_select',
                            class_name: 'kiosk_pay_statuses_select',
                            items: leadStatuses,
                            selected: payStatusInput.val()
                        });


                        defaultStatusInput.hide().closest('.widget_settings_block__input_field').prepend(default_statuses_select_html);
                        payStatusInput.hide().closest('.widget_settings_block__input_field').prepend(pay_statuses_select_html);

                        var defaultStatusHiddenInput = $('#kiosk_default_statuses_select');
                        var payStatusHiddenInput = $('#kiosk_pay_statuses_select');

                        defaultStatusHiddenInput.parents('.kiosk_default_statuses_select').css({width: '396px', 'margin': '5px 0 0 0'});
                        payStatusHiddenInput.parents('.kiosk_pay_statuses_select').css({width: '396px', 'margin': '5px 0 0 0'});

                        defaultStatusHiddenInput.on('change', function() {
                            defaultStatusInput.val($(this).val()).trigger('controls:change:visual');;
                        });

                        payStatusHiddenInput.on('change', function() {
                            payStatusInput.val($(this).val()).trigger('controls:change:visual');;
                        });
                    });

                } catch(e) {
                    console.error('Settings', e);
                }

                return true;
            },
            onSave: function(fieldlist){
                try {
                    let send_data = {};
                    send_data.goods_catalog_id = fieldlist.fields.goods_catalog_id;
                    send_data.is_active = fieldlist.active?true:false;
                    send_data.initial_state_id = fieldlist.fields.status_id_default;
                    send_data.paid_state_id = fieldlist.fields.status_id_pay;

                    $.ajax({
                        url: API_BASE + '/settings',
                        type: 'PUT',
                        dataType: 'json',
                        data: send_data,
                        success: function(response) {
                            console.log('response', response);
                        }
                    });

                } catch(e) {
                    console.error("On save error", e);
                } finally {
                    return true;
                }
            },
            destroy: function(){
                console.log('disabled');
            },
            contacts: {
                    selected: function(){
                    }
                },
            leads: {
                    selected: function(){
                    }
                },
            tasks: {
                    selected: function(){
                    }
                }
        };

        this.error = function( header, text ){
            AMOCRM.notifications.show_message_error({
                text: text,
                header: '<b class="widget_header__description_h">'+header+'</b>'
            });
        };

        return this;
    };
    return CustomWidget;
});
