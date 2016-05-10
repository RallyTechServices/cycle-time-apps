Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container',itemId:'selector_box', layout: {type: 'hbox'}},
        {xtype:'container',itemId:'button_box', layout: {type: 'hbox'}},
        {xtype:'container',itemId:'display_box', padding: 25,  tpl: '<tpl><b>{msg}</b></tpl>'},
        {xtype:'container',
            itemId:'filter_box',
            padding: 10, 
            margin: 10,
            tpl:'<div class="ts-filter"><b>Applied Filters:</b><br><tpl for=".">{displayProperty} {operator} {value}<br></tpl></div>'},
        {xtype:'tsinfolink'}
    ],
    //scheduleStateMapping: {
    //    "21934055950": "Accepted",
    //    "21934055944": "Defined" ,
    //    "21934055946": "In-Progress",
    //    "21934055948": "Completed"
    //},
    exportHash: {
        formattedId: 'Formatted ID',
        days: 'Cycle Time (Days)',
        startDate: 'Start Date',
        endDate: 'End Date',
        pctBlocked: '% Cycle Time Blocked',
        pctReady: '% Cycle Time Ready'
    },
    config: {
        defaultSettings: {
            cycleStateFields:  "ScheduleState"
        },
    },
    defaultField: 'ScheduleState',
    cycleFields: [],
    granularityStore: [{
        displayName: 'Month',
        value: 'month',
        dateFormat: 'M yyyy',
        tickInterval: 1
    },{
        displayName: 'Week',
        value: 'week',
        dateFormat: 'M dd yyyy',
        tickInterval: 5
    }],
    hiddenSeries: [],
    dateRangeStore: [
                    {name: 'Last Complete Month', value: -1},
                    {name: 'Last 2 Complete Months', value: -2},
                    {name: 'Last 3 Complete Months', value: -3},
                    {name: 'Last 6 Complete Months', value: -6},
                    {name: 'Last 12 Complete Months', value: -12}
    ],
    defaultDateRange: -3,
    dataFilters: [],
    launch: function() {
        if (this.isExternal()){
            this.showSettings(this.config);
        } else {
            this.onSettingsUpdate(this.getSettings());  //(this.config.type,this.config.pageSize,this.config.fetch,this.config.columns);
        }        
    },
    _initializeApp: function(validFields){
       var field_store = Ext.create('Rally.data.custom.Store', {
            data: validFields,
            autoLoad: true
        });

        this.logger.log('_initializeApp', validFields);
        
        var cb = this.down('#selector_box').add({
            xtype: 'rallycombobox',
            itemId: 'cb-field',
            store: field_store, 
            valueField: 'name',
            displayField: 'displayName',
            fieldLabel:  'Field',
            labelAlign: 'right',
            labelWidth: 50,
            queryMode: 'local',
            allowNoEntry: false, 
            margin: 10,
            scope: this,
            listeners: {
                scope: this,
                select: this._updateDropdowns,
                ready: function(cb){
                    this._updateDropdowns(cb);
                }
            }
        });
    },
    _getGroupPrecedence: function(){
        var data = this.down('#cb-from-state').getStore().data;
        
        var group = [];  
        Ext.each(data.items,function(rec){
            group.push(rec.get('ObjectID'));
        });
        this.logger.log('_getGroupPrecedence',this.down('#cb-from-state').getStore(), group);
        return group;  
    },
     _fetchFields: function(cycleStateFields){
         var deferred = Ext.create('Deft.Deferred');
         this.logger.log('_fetchFields', cycleStateFields);
         var allowed_attribute_types = ['STATE','STRING'];
         var additional_filterable_fields = ['PlanEstimate'];
         var valid_fields = [];
         var filter_fields = [];
         
         var promises = [this._fetchModelFields('HierarchicalRequirement'),this._fetchModelFields('Defect')];
         Deft.Promise.all(promises).then({
             scope: this,
             success: function(fields){
                 var scheduleStateField = null; 
                 fields = _.flatten(fields);
                 this.logger.log('_fetchFields success', fields);
                 var field_names = [];
                 Ext.each(fields, function(f){
                     if (f.hidden === false && f.attributeDefinition){
                         var attr_def = f.attributeDefinition;
                        if (!Ext.Array.contains(field_names, attr_def.ElementName)){
                             if (Ext.Array.contains(cycleStateFields,attr_def.ElementName)){
                                 valid_fields.push(f);

                             }
                             if (Ext.Array.contains(additional_filterable_fields, attr_def.ElementName) || 
                                             (attr_def.Constrained && Ext.Array.contains(allowed_attribute_types, attr_def.AttributeType) && attr_def.ReadOnly == false)){
                                     field_names.push(attr_def.ElementName);
                                     filter_fields.push(f);
                             }
                         }
                     }
                 });
                 
                 this.filterFields = _.uniq(filter_fields);  
                 this.cycleFields = _.uniq(valid_fields); 
                 deferred.resolve();
             }
         });
         return deferred;  
     },
     _fetchModelFields: function(type){
         var deferred = Ext.create('Deft.Deferred');
         Rally.data.ModelFactory.getModel({
             type: type,
             scope: this, 
             success: function(model) {
                 this.logger.log('_fetchModelFields', model.getFields());
                 deferred.resolve(model.getFields());

             }
         });
         return deferred;  
     },
    /**
     * Called when the field is updated.  
     */
    _updateDropdowns: function(cb){
        
        this.logger.log('_updateDropdowns', cb.getValue(), cb.getRecord());
        
        if (this.down('#cb-from-state')){
            this.down('#cb-date-range').destroy();
            this.down('#cb-from-state').destroy();
            this.down('#cb-to-state').destroy();
            this.down('#cb-granularity').destroy();
            this.down('#btn-update').destroy();
            this.down('#btn-filter').destroy();
            this.down('#btn-export').destroy();
        }
       
        var field = cb.getValue();
        
        if (cb.getRecord()){
            var model = cb.getRecord().get('modelType');
            
            this.down('#selector_box').add({
                xtype: 'rallyfieldvaluecombobox',
                itemId: 'cb-from-state',
                model: model,
                field: field,
                valueField: 'ObjectID',
                allowNoEntry: false,
                fieldLabel:  'Start',
                labelAlign: 'right',
                labelWidth: 30,
                margin: 10
            });
            
            this.down('#selector_box').add({
                xtype: 'rallyfieldvaluecombobox',
                itemId: 'cb-to-state',
                model: model,
                field: field,
                fieldLabel:  'End',
                labelAlign: 'right',
                labelWidth: 30,
                margin: 10
            });
            
            var granularity_store = Ext.create('Rally.data.custom.Store', {
                data: this.granularityStore
            });
            this.down('#selector_box').add({
                xtype: 'rallycombobox',
                itemId: 'cb-granularity',
                store: granularity_store,
                displayField: 'displayName',
                valueField: 'value',
                fieldLabel:  'Granularity',
                labelAlign: 'right',
                labelWidth: 65,
                margin: 10
            });

            var date_store = Ext.create('Rally.data.custom.Store', {
                data: this.dateRangeStore
            });

            this.down('#selector_box').add({
                xtype: 'rallycombobox',
                itemId: 'cb-date-range',
                store: date_store,
                displayField: 'name',
                valueField: 'value',
                fieldLabel:  'Date Range',
                labelAlign: 'right',
                labelWidth: 65,
                width: 250,
                value: this.defaultDateRange,
                margin: 10
            });
            
            var button_width = 75;
            this.down('#button_box').add({
                xtype: 'rallybutton',
                itemId: 'btn-update',
                text: 'Update',
                scope: this,
                width: button_width,
                margin: '5 5 5 65',
                handler: this._createChart
            });
            
            this.down('#button_box').add({
                xtype: 'rallybutton',
                itemId: 'btn-filter',
                scope: this,
                text: 'Filter',
                width: button_width,
                margin: 5,
                handler: this._filter
            });
            this.down('#button_box').add({
                xtype: 'rallybutton',
                itemId: 'btn-export',
                scope: this,
                text: 'Export',
                width: button_width,
                margin: 5,
                handler: this._export
            });
        }
    },
    _getStartState: function(){
        return this.down('#cb-from-state').getValue();
    },
    _getEndState: function(){
        return this.down('#cb-to-state').getValue();
    },

    _createChart: function(){
        var field = this.down('#cb-field').getValue();
        var granularity_rec = this.down('#cb-granularity').getRecord();
        var granularity = granularity_rec.get('value');  
        var end_date = new Date(); 
        
        var date_range = this.down('#cb-date-range').getValue();
        var start_date = Rally.util.DateTime.add(new Date(),"month",date_range);
        var start_state = this._getStartState();
        var filters = this.dataFilters;  
        filters.push({
            property: 'Children',
            value: ""
        });
        
        this.logger.log('_createChart', field, start_state, this._getEndState(), granularity, start_date, end_date);

        this.setLoading('Fetching data...');
        this._cleanUI(['#rally-chart','#rally-grid']);

        this.loadSnapshots([this._getStoreConfig('Defect'),this._getStoreConfig('HierarchicalRequirement')]).then({
            scope: this,
            success: function(snapshots){
                var calc = Ext.create('CycleCalculator', {
                    cycleField: field,
                    cycleStartValue: start_state,
                    cycleEndValue: this._getEndState(),
                    cyclePrecedence: this._getGroupPrecedence(),
                    startDate: start_date,
                    endDate: end_date,
                    granularity: granularity,
                    dateFormat: granularity_rec.get('dateFormat'),
                    dataFilters: filters            
                });
                
                this.setLoading(false);
                var chart_data = calc.runCalculation(snapshots);
                this._drawChart(chart_data);
                this._buildGrid(calc.summaryData);
                this.exportData = calc.cycleTimeDataExport;
            },
            failure: function(msg){
                var error_msg = msg + '.  Please retry your request.';
                this._cleanUI(['#rally-chart','#rally-grid'], error_msg);
                this.setLoading(false);
            }
        });
    },
    _export: function(){
        if (this.exportData){
            this.logger.log('_export', this.exportHash);
            var text = Rally.technicalservices.FileUtilities.convertDataArrayToCSVText(this.exportData, this.exportHash);
            Rally.technicalservices.FileUtilities.saveTextAsFile(text, 'flow-efficiency.csv');
        }
    },
    _cleanUI: function(componentIds, msg){

        Ext.each(componentIds, function(c){
            if (this.down(c)){
                this.down(c).destroy();
            }
        }, this);
        
        if (msg == undefined){
            msg = '';
        }
        this.down('#display_box').update({msg: msg});
    },
    _drawChart: function(chart_data){
        this.logger.log('_drawChart');
        
        var me = this;
        var chart = this.down('#rally-chart') 
        if (chart){
            this.down('#rally-chart').destroy(); 
            this.down('#rally-grid').destroy();
        }

        var granularity_rec = this.down('#cb-granularity').getRecord();
        var title_text = 'Average Flow Efficiency from ' + (this._getStartState() || '(None)') + ' to ' + this._getEndState();
        var tick_interval = granularity_rec.get('tickInterval');  
        
        this.down('#display_box').add({
            xtype: 'rallychart',
            itemId: 'rally-chart',
            chartData: chart_data, 
            loadMask: false,
            chartColors:['#000000','#8bbc21','#c42525','#8bbc21','#c42525'],
            updateAfterRender: function(){
                if (me.hiddenSeries && me.hiddenSeries.length > 0){
                    Ext.each(this.chartData.series, function(s){
                        if (Ext.Array.contains(me.hiddenSeries, s.name)){
                            s.visible = false;
                        }
                    });
                }
           },
            updateBeforeRender: this._beforeChartRender,
            chartConfig: {
                chart: {
                    zoomType: 'xy',
                    type: 'line'
                },
                title: {
                    text: title_text
                },
                xAxis: {
                    tickInterval: tick_interval,
                    title: {
                        text: 'Date Entered ' + this._getEndState()
                    }
                },
                yAxis: [
                    {
                        title: {
                            text: '% Flow Efficiency'
                        },
                        //min: 0,
                        max: 100
                    }
                ],
                plotOptions: {
                    series: {
                        dataLabels: {
                            format: '{point.y:.1f}%'
                        },
                        marker: {
                            enabled: false,
                        },
                        events: {
                            legendItemClick: function () {
                                if (this.visible){
                                    //we are hiding it
                                    me.hiddenSeries = _.union(me.hiddenSeries, [this.name]);  
                                } else {
                                    me.hiddenSeries = _.without(me.hiddenSeries, this.name);
                                }
                            }
                        }

                    },
                    line: {
                        connectNulls: true,
                        tooltip: {
                            pointFormat: '<span style="color:{series.color}">\u25CF</span> {series.name}: <b>{point.y:.1f}%</b><br/>'
                        }
                    }
                },
            }
        });        
    },
    _buildGrid: function(summaryData){
        this.logger.log('_buildGrid',summaryData);
        
        var store = Ext.create('Rally.data.custom.Store', {
            data: summaryData
        });
        
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            itemId: 'rally-grid',
            columnCfgs: [{
                text: 'Date',
                dataIndex: 'date'
            },{
                text: '% Blocked',
                dataIndex: 'pctBlocked'
            },{
                text: '% Ready',
                dataIndex: 'pctReady'
            },{
                text: 'Avg Cycle Time',
                dataIndex: 'avgCycleTime'
            },{
                text: 'Total Cycle Time',
                dataIndex: 'totalCycleTime'
            },{
                text: 'Total Artifacts',
                dataIndex: 'numArtifacts'
            }]
        });
    }, 
    _beforeChartRender: function(){
        this.chartConfig.plotOptions.line.tooltip.pointFormat = '<span style="color:{series.color}">\u25CF</span> {series.name}: <b>{point.y:.1f}% {point.n}</b><br/>';
    },
    _setFilters: function(filters){
        this.dataFilters = filters;  
        this.down('#filter_box').update(filters);
    },
    _filter: function(){
        this.logger.log('_filter', this.filterFields);
        Ext.create('Rally.technicalservices.dialog.Filter',{
            validFields: this.filterFields,
            filters: this.dataFilters,
            listeners: {
                scope: this,
                customFilter: function(filters){
                    this.logger.log('_filter event fired',filters);
                    this._setFilters(filters);
                    this._createChart();
                }
            }
        });
    },
    /**
     * Functions to load the snapshots upfront
     * 
     */
    loadSnapshots: function(storeConfigs){
        var deferred = Ext.create('Deft.Deferred');  
        this.logger.log('loadSnapshots', storeConfigs);

        var promises = []; 
        Ext.each(storeConfigs, function(storeConfig){
            promises.push(this._loadStore(storeConfig));
        }, this);
        
        Deft.Promise.all(promises).then({
            scope: this,
            success: function(snapshots){
                this.logger.log('loadSnapshots success', snapshots);
                var hydrated_snaps = [];  
               // var scheduleStateMapping = this.scheduleStateMapping;
                for(var i=0; i< snapshots.length; i++){
                    var type = storeConfigs[i]["find"]["_TypeHierarchy"];
                    //Now we will hydrate the type ourselves
                    hydrated_snaps.push(_.map(snapshots[i],function(snap){
                        var obj = snap.getData();
                      //  obj["ScheduleState"] = scheduleStateMapping[snap.get('ScheduleState').toString()]
                        obj["_TypeHierarchy"] = [type];
                        return obj;
                    }));
                    
                }
                hydrated_snaps = _.flatten(hydrated_snaps);
                deferred.resolve(hydrated_snaps);
            },
            failure: function(type){
                var msg = "Error fetching data for " + type;
                deferred.reject(msg);
            }
        });
        return deferred; 
    },
    _loadStore: function(storeConfig){
        var deferred = Ext.create('Deft.Deferred');
        
        this.logger.log('_loadStore', storeConfig); 
        var start = Date.now();
        storeConfig = _.extend(storeConfig, {
            limit: 'Infinity',
            removeUnauthorizedSnapshots: true,
            autoLoad: true,
            sort: {
                _ValidFrom: 1
            },
            listeners: {
                scope: this, 
                load: function(store,records,success){
                    this.logger.log('_loadStore load returned', Date.now()-start, records.length, success, records);
                    if (success) {
                        deferred.resolve(records);
                    } else {
                        this.logger.log('_loadStore failed for config',Date.now()-start, storeConfig);
                        deferred.reject(storeConfig["find"]["_TypeHierarchy"]);
                    }
                }
            }
        });
        this.logger.log('_loadStore create store');
        Ext.create('Rally.data.lookback.SnapshotStore',storeConfig);
        
        return deferred; 
    },
    _getStoreConfig: function(type){
        var field = this.down('#cb-field').getValue();
        var fetch = this._getFetchFields();
        this.logger.log('_getStoreConfig', type, field, fetch);
        var find = {
                "_TypeHierarchy": type
            };
        
        var project = this.getContext().getProject().ObjectID; 
        if (this.getContext().getProjectScopeDown()){
            find["_ProjectHierarchy"] = {$in: [project]};
        } else {
            find["Project"]= project;
        }
        var store_config ={
             find: find,
             fetch: fetch,
             hydrate: ['ScheduleState'],
             sort: {
                 _ValidFrom: 1
             },
             context: this.getContext().getDataContext(),
        }
//        if (type == 'HierarchicalRequirement'){
//            store_config["context"] = {workspace: 'bldkjs/dakfjfa'};
//        }
        this.logger.log('_getStoreConfig', store_config);
        return store_config;
    },
    _getFetchFields: function(){
        var field = this.down('#cb-field').getValue();
        var fetch_fields = ['ObjectID',field,'_TypeHierarchy','_SnapshotNumber','ScheduleState','FormattedID','Blocked','Ready','_ValidTo','_ValidFrom','Children'];
        
        var filter_fields = [];  
        Ext.each(this.dataFilters, function(f){
            if (f.property != field){
                filter_fields.push(f.property);
            }
        },this);
        this.logger.log('_getFetchFields', Ext.Array.merge(fetch_fields,filter_fields));
        return Ext.Array.merge(fetch_fields,filter_fields);
    },
    /********************************************
    /* Overrides for App class
    /*
    /********************************************/
    //getSettingsFields:  Override for App    
    getSettingsFields: function() {
        
        return [
                {
            name: 'cycleStateFields',
            xtype: 'rallyfieldpicker',
            modelTypes: ['HierarchicalRequirement','Defect'],
            labelWidth: 100,
            fieldLabel: 'Valid Cycle States',
            labelAlign: 'left',
            minWidth: 400,
            margin: '10 0 255 0',
            autoExpand: false,
            alwaysExpanded: false,
            storeConfig: {
                context: {project: null}
            }
        }];
    },
    isExternal: function(){
      return typeof(this.getAppId()) == 'undefined';
    },
    //showSettings:  Override
    showSettings: function(options) {      
        this._appSettings = Ext.create('Rally.app.AppSettings', Ext.apply({
            fields: this.getSettingsFields(),
            settings: this.getSettings(),
            defaultSettings: this.getDefaultSettings(),
            context: this.getContext(),
            settingsScope: this.settingsScope,
            autoScroll: true
        }, options));
        
        this._appSettings.on('cancel', this._hideSettings, this);
        this._appSettings.on('save', this._onSettingsSaved, this);
        if (this.isExternal()){
            if (this.down('#settings_box').getComponent(this._appSettings.id)==undefined){
                this.down('#settings_box').add(this._appSettings);
            }
        } else {
            this.hide();
            this.up().add(this._appSettings);
        }
        return this._appSettings;
    },
    _onSettingsSaved: function(settings){
        Ext.apply(this.settings, settings);
        this._hideSettings();
        this.onSettingsUpdate(settings);
    },
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        //Build and save column settings...this means that we need to get the display names and multi-list
        var cycleStateFields_setting = this.getSetting('cycleStateFields');
        if (cycleStateFields_setting instanceof Array){
            cycleStateFields = cycleStateFields_setting;
        } else {
            cycleStateFields = cycleStateFields_setting.split(',');
        }
        this.logger.log('onSettingsUpdate',settings, cycleStateFields);
        this._fetchFields(cycleStateFields).then({
            scope: this,
            success: function(){
                this.logger.log('Valid fields for cycle and filter time', this.cycleFields, this.filterFields); 
                this._initializeApp(this.cycleFields);
            }
        });


    }
});