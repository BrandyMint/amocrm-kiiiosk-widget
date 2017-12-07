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
                return new Promise(function(resolve){
                    if(AmoApi.current) {
                        resolve(AmoApi.current);
                    }

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
         * Return statusId from (pipelineId|statusId) string
         * @param  {String} $pipeSepStatus (pipelineId|statusId)
         * @return {String}                status id
         */
        function getStatusIdFromPipeStatus(pipeSepStatus) {
            if(0 === pipeSepStatus.length ) {
                return '';
            }

            let arPipeStatus = pipeSepStatus.split('|');

            return (arPipeStatus.length == 2) ? arPipeStatus[1] : '';
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
                user = AMOCRM.constant('user');
                account = AMOCRM.constant('account');
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
                        goodsCatalogHiddenInput.parents('.kiosk_goods_catalog_statuses_select').css({width: '278px', 'margin': '5px 0 0 0'});

                        goodsCatalogHiddenInput.on('change', function() {
                            goodsCatalogInput.val($(this).val()).trigger('controls:change:visual');
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
                        _.each(r.response.account.pipelines, function(pipeline, pipeline_id){
                            _.each(pipeline.statuses, function(status, status_id){
                                leadStatuses.push({
                                    option: pipeline.name + ': ' + status.name,
                                    id: pipeline_id + '|' + status.id
                                });
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

                        defaultStatusHiddenInput.parents('.kiosk_default_statuses_select').css({width: '278px', 'margin': '5px 0 0 0'});
                        payStatusHiddenInput.parents('.kiosk_pay_statuses_select').css({width: '278px', 'margin': '5px 0 0 0'});

                        defaultStatusHiddenInput.off('change.wKiosk').on('change.wKiosk', function() {
                            defaultStatusInput.val($(this).val()).trigger('controls:change:visual');
                        });

                        payStatusHiddenInput.off('change.wKiosk').on('change.wKiosk', function() {
                            payStatusInput.val($(this).val()).trigger('controls:change:visual');
                        });
                    });

                    /* Привязывать товары при экспорте сделки в AmoCRM enable_goods_linking */
                    let enableGoodsLinkingInput = $('input[name="enable_goods_linking"]');
                    let isEnabledGoodsLinkInput = enableGoodsLinkingInput.val() == 'true';
                    let swatcher = `<div class="switcher_wrapper">
                        <label for="kiosk_is_enable_goods_linking" class="switcher switcher_blue ${isEnabledGoodsLinkInput? 'switcher__on' : 'switcher__off'}" id=""></label>
                        <input value="${enableGoodsLinkingInput.val()}" name="kiosk_enable_goods_linking" id="kiosk_is_enable_goods_linking" class="switcher__checkbox" ${isEnabledGoodsLinkInput ? 'checked' : ''} type="checkbox">
                    </div>`;

                    enableGoodsLinkingInput.hide().closest('.widget_settings_block__item_field').append(swatcher);

                    let enableGoodsLinkingHiddentInput = $('input[name="kiosk_enable_goods_linking"]');

                    enableGoodsLinkingHiddentInput.on('change', function(){
                        let checked = $(this).is(':checked')? 'true' : 'false';
                        enableGoodsLinkingInput.val(checked);
                    });

                    // FOR toggle save button
                    enableGoodsLinkingInput.on('change', function(){
                        enableGoodsLinkingInput.trigger('controls:change:visual');
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
                    send_data.initial_state_id = getStatusIdFromPipeStatus(fieldlist.fields.status_id_default);
                    send_data.paid_state_id = getStatusIdFromPipeStatus(fieldlist.fields.status_id_pay);
                    send_data.apikey = system.amohash;
                    send_data.login = system.amouser;
                    send_data.enable_goods_linking = fieldlist.fields.enable_goods_linking;
                    send_data.url = 'https://' + system.domain;

                    let apiKey = fieldlist.fields.api_key;

                    $.ajax({
                        url: API_BASE + '/settings',
                        type: 'PUT',
                        dataType: 'json',
                        data: send_data,
                        headers: { "X-Api-Key": apiKey },
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
