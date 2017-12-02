/*eslint no-undef: "off"*/
define(['jquery'], function($){
    var CustomWidget = function (){

        let self = this,
            system = self.system(),
            send_data = {};
        ;

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
            getCatalogListOptions: function(catalog_name){
                return new Promise(function (resolve) {
                    $.get('/private/api/v2/json/catalogs/list').then(function (data) {
                        let catalogListOptions = _.map(data.response.catalogs, function (catalog, catalog_id) {
                            return `<option value="${catalog_id}" ${catalog.name == catalog_name? 'selected' : ''}>${catalog.name}</option>`;
                        }).join("\n");

                        resolve(catalogListOptions);
                    });
                });
            },
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
                let goods_catalog_field = $('input[name="goods_catalog_name"]');
                let goods_catalog_field_val = $('input[name="goods_catalog_id"]').val();
                let goods_catalog_field_selected = goods_catalog_field_val
                    ? goods_catalog_field_val
                    : 'Товары'
                ;

                AmoApi.getCatalogListOptions(goods_catalog_field_selected).then((list)=>{
                    let select = `<select name="catalog_list" id="kiosk_goods_catalog_id">${list}</select>`;
                    goods_catalog_field
                        .closest('.widget_settings_block__input_field')
                        .append(select)
                    ;

                    let selected_name = $('#kiosk_goods_catalog_id').find(':selected').text();

                    if( selected_name !== goods_catalog_field_val ) {
                        goods_catalog_field.val( selected_name ).trigger('controls:change:visual');
                    }

                    $('#kiosk_goods_catalog_id').off('change.kiosk').on('change.kiosk', function(){
                        goods_catalog_field.val( $(this).find(':selected').text() ).trigger('controls:change:visual');
                    });
                });

                /* status_id_default */
                // let $chStatusInput = $('input[name="status_id_default"]');
                // let statuses = [{
                //         option: 'Не выбран',
                //         id: 0,
                //     }];

                // AmoApi.getCurrent().then( (r) => {
                //     r.response.account.leads_statuses.forEach(function(status){
                //         statuses.push({
                //             option: status.name,
                //             id: status.id
                //         });
                //     });
                // });

                // console.log('statuses', statuses);
                // var default_statuses_select_html = self.render({ref: '/tmpl/controls/select.twig'}, {
                //     id: 'ch_statuses_select',
                //     class_name: 'ch_statuses_select',
                //     items: statuses,
                //     selected: +$chStatusInput.val(),
                // });


                // $chStatusInput.hide().parent().prepend(default_statuses_select_html);
                // var $statusHiddenInput = $('#ch_statuses_select');
                // $statusHiddenInput.parents('.ch_statuses_select').css({width: '396px', 'margin': '5px 0 0 0'});
                // $statusHiddenInput.on('change', function() {
                //     $chStatusInput.val($(this).val());
                // });

                return true;
            },
            onSave: function(fieldlist){
                let send_data = {};
                send_data.goods_catalog_id = $('#kiosk_goods_catalog_id').val();
                send_data.is_active = fieldlist.active
                console.log(send_data)
                console.log(fieldlist);
                return true;
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
