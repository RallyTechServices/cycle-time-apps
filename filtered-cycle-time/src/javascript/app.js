Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    exportHash: {
        formattedId: 'Formatted ID',
        days: 'Cycle Time (Days)',
        startDate: 'Start Date',
        endDate: 'End Date'
    },
    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype: 'container', itemId: 'type_selector_box', layout: {type: 'hbox'}},
        {xtype: 'container', itemId: 'value_selector_box', layout: {type: 'hbox'}},
        {xtype: 'container', itemId: 'time_box', layout: {type: 'hbox'}},
        {xtype:'container',itemId:'button_box', layout: {type: 'hbox'}},
    //    {xtype:'container',itemId:'filter_box', layout: {type: 'vbox'}, title: 'Filter by', border: 1, style: {borderColor: 'gray', borderStyle: 'solid'}},
        {xtype:'container',itemId:'display_box'},
        {xtype:'container',
            itemId:'filter_box',
            padding: 10, 
            margin: 10,
            tpl:'<div class="ts-filter"><b>Applied Filters:</b><br><tpl for=".">{displayProperty} {operator} {displayValue}<br></tpl></div>'},
        {xtype:'tsinfolink'}
    ],
    config: {
        defaultSettings: {
            cycleStateFields:  "ScheduleState",
            modelNames: ['HierarchicalRequirement','Defect'],
            percentileLineThreshold: 85
        }
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
    _getValidFields: function(type){
        var cycleStateFields = [],
            defaultFields = ['ScheduleState'];

        if (type) {
            this.modelNames = type.split(',');
            this.logger.log('_getValidFields',type,this.modelNames);


            if (/PortfolioItem/.test(this.modelNames[0])){
                cycleStateFields = this.getSetting('portfolioItemCycleStateFields');
                defaultFields = ['State'];
            } else {
                //Story/Defect fields
                cycleStateFields = this.getSetting('storyDefectCycleStateFields');
            }
            this.logger.log('cycleStateFields',cycleStateFields);
            if (cycleStateFields && !Ext.isArray(cycleStateFields) ){
                cycleStateFields = cycleStateFields.split(',');
            }

            this.logger.log("Settings fields:", cycleStateFields);
            if (!cycleStateFields || cycleStateFields.length === 0 || Ext.isEmpty( cycleStateFields[0] ) ) {
                cycleStateFields = defaultFields;
            }

            this._fetchFields(cycleStateFields).then({
                scope: this,
                success: function(){
                    this.logger.log('Valid fields for cycle and filter time', this.cycleFields, this.filterFields);
                    this._addFieldPicker(this.cycleFields);
                }
            });
        }
    },
    _addFieldPicker: function(validFields){

            if (this.down('#cb-field')) {
                this.down('#cb-field').destroy();
            }

        var field_store = Ext.create('Rally.data.custom.Store', {
                data: validFields,
                autoLoad: true
            });

            this.down('#type_selector_box').add({

                xtype: 'rallycombobox',
                itemId: 'cb-field',
                store: field_store,
                valueField: 'name',
                displayField: 'displayName',
                fieldLabel: 'Field',
                labelAlign: 'right',
                labelWidth: 65,
                queryMode: 'local',
                allowNoEntry: false,
                margin: 10,
                scope: this,
                listeners: {
                    scope: this,
                    select: this._updateDropdowns,
                    ready: function (cb) {
                        this._updateDropdowns(cb);
                    }
                }
            });
    },
    _addTypePicker: function(type){

        this.down('#type_selector_box').add({
            xtype: 'rallycombobox',
            autoExpand: true,
            storeConfig: {
                model:'TypeDefinition',
                filters: [{property:'TypePath',operator:'contains',value:'PortfolioItem/'}],
                autoLoad: true
            },
            displayField: 'DisplayName',
            valueField: 'TypePath',
            fieldLabel:  'Type',
            labelAlign: 'right',
            minWidth: 250,
            labelWidth: 65,
            margin: 10,
            listeners: {
                scope: this,
                ready: function(cb) {
                    this._addArtifactToChoices(cb.getStore());
                    if (type){
                        cb.setValue(type);
                    }
                    this._getValidFields(cb.getValue());
                },
                select: function(cb){
                    this._getValidFields(cb.getValue());
                }
            }
        });
    },
    _getGroupNames: function() {
        var group_names = {}; // key will be objectID
        var data = this.down('#cb-from-state').getStore().data;
        
        Ext.each(data.items,function(rec){
            var oid = rec.get('ObjectID');
            var trimmed_oid = oid.replace(/\/state\//,"").replace(/\/preliminaryestimate\//,"");
            if ( oid !== trimmed_oid ) {
                oid = parseInt(trimmed_oid,10);
            }
            group_names[oid] = rec.get('name');
            
        });
        return group_names;  
    },
    _getGroupPrecedence: function(){
        var data = this.down('#cb-from-state').getStore().data;
        
        var group = [];  
        Ext.each(data.items,function(rec){
            var oid = rec.get('ObjectID');
            var trimmed_oid = oid.replace(/\/state\//,"").replace(/\/preliminaryestimate\//,"");
            if ( oid !== trimmed_oid ) {
                oid = parseInt(trimmed_oid,10);
            }
            group.push(oid);
            
        });
        this.logger.log('_getGroupPrecedence',this.down('#cb-from-state').getStore(), group);
        return group;  
    },
    _fetchFields: function(cycleStateFields){
         var deferred = Ext.create('Deft.Deferred');
         this.logger.log('_fetchFields', cycleStateFields, this.modelNames);
         var allowed_attribute_types = ['STATE','STRING'];
         var additional_filterable_fields = ['PlanEstimate','Owner','PreliminaryEstimate'];
         var valid_fields = [];
         var filter_fields = [];
         
         var promises = [];
         Ext.Array.each( this.modelNames , function(model_name) {
            promises.push(this._fetchModelFields(model_name));
         },this);
         
         Deft.Promise.all(promises).then({
             scope: this,
             success: function(fields){
                 fields = _.flatten(fields);
                 this.logger.log('_fetchFields success', fields);
                 var field_names = [];
                 Ext.each(fields, function(f){
                     if (f.hidden === false && f.attributeDefinition){
                         var attr_def = f.attributeDefinition;
                         //this.logger.log(attr_def.ElementName, attr_def.Constrained, attr_def.AttributeType);
                         
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
                 },this);
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
                 this.logger.log('_fetchModelFields', type, model.getFields());
                 deferred.resolve(model.getFields());

             }
         });
         return deferred;  
     },
    /**
     * Called when the field is updated.  
     */
    _updateDropdowns: function(cb){
        var me = this;
        this.logger.log('_updateDropdowns', cb.getValue(), cb.getRecord());
        
        if (this.down('#cb-from-state')){
            this.down('#cb-date-range').destroy();
            this.down('#cb-from-state').destroy();
            this.down('#cb-to-state').destroy();
            this.down('#cb-excludeWeekends').destroy();
            this.down('#cb-granularity').destroy();
            this.down('#rb-time-box').destroy();
            this.down('#btn-update').destroy();
            this.down('#btn-filter').destroy();
            this.down('#btn-export').destroy();

        }
       
        var field = cb.getValue();
        
        if (cb.getRecord()){
            var model = cb.getRecord().get('modelType');
            
            this.down('#type_selector_box').add({
                xtype: 'rallyfieldvaluecombobox',
                itemId: 'cb-from-state',
                model: model,
                field: field,
                valueField: 'ObjectID',
                allowNoEntry: false,
                fieldLabel:  'Start',
                labelAlign: 'right',
                width: 200,
                labelWidth: 50,
                margin: 10
            });
            
            this.down('#type_selector_box').add({
                xtype: 'rallyfieldvaluecombobox',
                itemId: 'cb-to-state',
                model: model,
                field: field,
                fieldLabel:  'End',
                labelAlign: 'right',
                labelWidth: 50,
                margin: 10
            });

            this.down('#type_selector_box').add({
                name: 'excludeWeekends',
                itemId:'cb-excludeWeekends',
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: 10,
                boxLabel: 'Exclude Weekends'
            });
            
            var granularity_store = Ext.create('Rally.data.custom.Store', {
                data: this.granularityStore
            });
            this.down('#value_selector_box').add({
                xtype: 'rallycombobox',
                itemId: 'cb-granularity',
                store: granularity_store,
                displayField: 'displayName',
                valueField: 'value',
                fieldLabel:  'Granularity',
                labelAlign: 'right',
                width: 200,
                labelWidth: 65,
                margin: 10
            });

            var date_store = Ext.create('Rally.data.custom.Store', {
                data: this.dateRangeStore
            });

            this.down('#time_box').add({
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
            
            this.down('#value_selector_box').add({
                xtype      : 'radiogroup',
                fieldLabel : 'Select data for ',
                itemId: 'rb-time-box',
                defaults: {
                    flex: 1
                },
                margin: '10 5 5 25',
                layout: 'hbox',
                items: [
                    {
                        boxLabel  : 'Time Period',
                        name      : 'timebox',
                        inputValue: 'T',
                        id        : 'radio1',
                        checked   : true,
                        margin: '0 0 0 10'   
                    }, {
                        boxLabel  : 'Iteration',
                        name      : 'timebox',
                        inputValue: 'I',
                        id        : 'radio2',
                        margin: '0 0 0 10'
                    }, {
                        boxLabel  : 'Release',
                        name      : 'timebox',
                        inputValue: 'R',
                        id        : 'radio3',
                        margin: '0 0 0 10'
                    }
                ],
                listeners:{
                    change: function(rb){
                        if(rb.lastValue.timebox == 'T'){
                            me.down('#time_box').removeAll();
                                me.down('#time_box').add({
                                    xtype: 'rallycombobox',
                                    itemId: 'cb-date-range',
                                    store: date_store,
                                    displayField: 'name',
                                    valueField: 'value',
                                    fieldLabel:  'Date Range',
                                    labelWidth: 65,
                                    width: 250,
                                    value: this.defaultDateRange,
                                    margin: 10
                                });
                                
                        }else if(rb.lastValue.timebox == 'I'){
                                //console.log('me>>',me);
                                me.down('#time_box').removeAll();
                                me.down('#time_box').add({
                                    xtype: 'rallyiterationcombobox',
                                    fieldLabel: 'Iteration:',
                                    minWidth: 300,
                                    margin: 10,
                                    listeners: {
                                        scope: me,
                                        select: function(icb){
                                            me._getReleaseOrIterationOids(icb);
                                        },
                                        ready: function(icb){
                                            me._getReleaseOrIterationOids(icb);
                                        }
                                    }
                                });

                        }else if(rb.lastValue.timebox == 'R'){
                                me.down('#time_box').removeAll();
                                me.down('#time_box').add({
                                    xtype: 'rallyreleasecombobox',
                                    fieldLabel: 'Release:',
                                    minWidth: 300,
                                    margin: 10,
                                    listeners: {
                                        scope: me,
                                        select: function(icb){
                                            me._getReleaseOrIterationOids(icb);
                                        },
                                        ready: function(icb){
                                            me._getReleaseOrIterationOids(icb);
                                        }
                                    }
                                });
                        }
                    }
                }
        });

            var button_width = 75; 
            this.down('#value_selector_box').add({
                xtype: 'rallybutton',
                itemId: 'btn-update',
                text: 'Update',
                scope: this,
                width: button_width,
                margin: '10 5 5 25',
                handler: this._createChart
            });
            
            this.down('#value_selector_box').add({
                xtype: 'rallybutton',
                itemId: 'btn-filter',
                scope: this,
                text: 'Filter',
                width: button_width,
                margin: '10 5 5 5',
                handler: this._filter
            });
            this.down('#value_selector_box').add({
                xtype: 'rallybutton',
                itemId: 'btn-export',
                scope: this,
                text: 'Export',
                width: button_width,
                margin: '10 5 5 5',
                handler: this._export
            });
        }
    },
    _getStartState: function(){
        var state = this.down('#cb-from-state').getValue().replace(/\/state\//,""); // for the pi states
        
        if ( parseInt(state,10) > 0 ) {
            state = parseInt(state,10);
        }
        return state
    },
    _getEndState: function(){
        var state = this.down('#cb-to-state').getValue().replace(/\/state\//,""); // for the pi states
        
        if ( parseInt(state,10) > 0 ) {
            state = parseInt(state,10);
        }
        return state;
    },

    _getReleaseOrIterationOids: function(cb) {
        var me = this;
        me.logger.log('_getReleaseOrIterationOids',cb);
        me.timeboxValue = cb;
        Deft.Chain.parallel([
                me._getReleasesOrIterations
        ],me).then({
            scope: me,
            success: function(results) {
                me.logger.log('Results:',results);
                
                me.timebox_oids = Ext.Array.map(results[0], function(timebox) {
                    return timebox.get('ObjectID');
                });
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem Loading Timebox data', msg);
            }
        });
    },


    _getReleasesOrIterations:function(){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log('_getReleasesOrIterations>>',me.timeboxValue);

        var timeboxModel = '';
        var filters = [];

        if(me.timeboxValue.name == 'Iteration'){
            timeboxModel = 'Iteration';
            filters =         [        {
                    property: 'Name',
                    operator: '=',
                    value: me.timeboxValue.getRecord().get('Name')
                },
                {
                    property: 'StartDate',
                    operator: '=',
                    value: me.timeboxValue.getRecord().get('StartDate').toISOString()
                },
                {
                    property: 'EndDate',
                    operator: '=',
                    value: me.timeboxValue.getRecord().get('EndDate').toISOString()
                }
            ];
        }else if(me.timeboxValue.name == 'Release'){
            timeboxModel = 'Release';  
            filters =         [        {
                    property: 'Name',
                    operator: '=',
                    value: me.timeboxValue.getRecord().get('Name')
                },
                {
                    property: 'ReleaseStartDate',
                    operator: '=',
                    value: me.timeboxValue.getRecord().get('ReleaseStartDate').toISOString()
                },
                {
                    property: 'ReleaseDate',
                    operator: '=',
                    value: me.timeboxValue.getRecord().get('ReleaseDate').toISOString()
                }
            ];
        }

        Ext.create('Rally.data.wsapi.Store', {
            model: timeboxModel,
            fetch: ['ObjectID'],
            filters: Rally.data.wsapi.Filter.and(filters)
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    //console.log('records',records,'operation',operation,'successful',successful);
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },


    _createChart: function(){
        var me = this;
        var field = this.down('#cb-field').getValue();
        var granularity_rec = this.down('#cb-granularity').getRecord();
        var granularity = granularity_rec.get('value');  
        var start_date,end_date = new Date(); 
        var excludeWeekends = me.down('#cb-excludeWeekends').value;
                    
        me.logger.log('Timebox value >>',me.timeboxValue);

        if(this.down('#rb-time-box').getValue().timebox == 'I'){
            // find["Iteration"] = { '$in': this.timebox_oids };
            if(me.timeboxValue){
                start_date = new Date(me.timeboxValue.getRecord().get('StartDate'));
                end_date = new Date(me.timeboxValue.getRecord().get('EndDate'));
            }
        }else if(this.down('#rb-time-box').getValue().timebox == 'R'){
            // find["Release"] = { '$in': this.timebox_oids };
            if(me.timeboxValue){
                start_date = new Date(me.timeboxValue.getRecord().get('ReleaseStartDate'));
                end_date = new Date(me.timeboxValue.getRecord().get('ReleaseDate'));
            }
        }else{
            var date_range = this.down('#cb-date-range').getValue();
            start_date = Rally.util.DateTime.add(new Date(),"month",date_range);
        }

        me.logger.log('Dates Before running calculator>>',start_date,end_date);

        var start_state = this._getStartState();
        var filters = this.dataFilters;  
        
        this.logger.log('_createChart', field, start_state, this._getEndState(), granularity, start_date, end_date);

        this.setLoading('Fetching data...');
        var store_configs = [];
        
        Ext.Array.each( this.modelNames , function(model_name) {
            store_configs.push(this._getStoreConfig(model_name));
         },this);
         
        this.loadSnapshots(store_configs).then({
            scope: this,
            success: function(snapshots){
                var calc = Ext.create('CycleCalculator', {
                    cycleField: field,
                    cycleStartValue: start_state,
                    cycleEndValue: this._getEndState(),
                    cyclePrecedence: this._getGroupPrecedence(),
                    cycleNames: this._getGroupNames(),
                    modelNames: this.modelNames,
                    startDate: start_date,
                    endDate: end_date,
                    granularity: granularity,
                    dateFormat: granularity_rec.get('dateFormat'),
                    dataFilters: filters,
                    percentileLineThreshold: this.getSetting('percentileLineThreshold'),
                    excludeWeekends:excludeWeekends
                });
                this.setLoading(false);
                var chart_data = calc.runCalculation(snapshots);
                this._drawChart(chart_data);
                this.exportData = calc.cycleTimeDataExport;
            }
        });
    },
    _export: function(){
        if (this.exportData){

            this.logger.log('_exportData', this.exportHash);
            var text = Rally.technicalservices.FileUtilities.convertDataArrayToCSVText(this.exportData, this.exportHash);
            Rally.technicalservices.FileUtilities.saveTextAsFile(text, 'cycle-time.csv');
        }
    },
    _getChartColors: function() {
        if ( this.modelNames.length > 1 ) {
            return ['#000000','#8bbc21','#c42525','#8bbc21','#c42525'];
        }
        return ['#8bbc21','#8bbc21','#8bbc21','#8bbc21'];
    },
    _drawChart: function(chart_data){
        this.logger.log('_drawChart');
        
        var me = this;
        var chart = this.down('#rally-chart') 
        if (chart){
            this.down('#rally-chart').destroy(); 
        }

        var granularity_rec = this.down('#cb-granularity').getRecord();
        
        var state_names = this._getGroupNames();
        
        var start_state = state_names[this._getStartState()] || this._getStartState() || '(None)';
        var end_state = state_names[this._getEndState()] || this._getEndState() || '(None)';
        
        var title_text = 'Average Cycle Time from ' + start_state + ' to ' + end_state;
        var tick_interval = granularity_rec.get('tickInterval');  
        
        var chart_colors = this._getChartColors();
        
        this.down('#display_box').add({
            xtype: 'rallychart',
            itemId: 'rally-chart',
            chartData: chart_data, 
            loadMask: false,
            chartColors: chart_colors,
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
                        text: 'Date Entered ' + end_state
                    }
                },
                yAxis: [
                    {
                        title: {
                            text: 'Days'
                        },
                        min: 0
                    }
                ],
                plotOptions: {
                    series: {
                        dataLabels: {
                            format: '{point.y:.1f}'
                        },
                        marker: {
                            enabled: false
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
                            pointFormat: '<span style="color:{series.color}">\u25CF</span> {series.name}: <b>{point.y:.1f}</b><br/>'
                        }
                    }
                }

            }
        });        
    },
    _beforeChartRender: function(){
        this.chartConfig.plotOptions.line.tooltip.pointFormat = '<span style="color:{series.color}">\u25CF</span> {series.name}: <b>{point.y:.1f} {point.n}</b><br/>';
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
            app: this,
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
                for(var i=0; i< snapshots.length; i++){
                    var type = storeConfigs[i]["find"]["_TypeHierarchy"];
                    //Now we will hydrate the type ourselves
                    hydrated_snaps.push(_.map(snapshots[i],function(snap){
                        var obj = snap.getData();
                        obj["_TypeHierarchy"] = [type];
                        return obj;
                    }));
                    
                }
                hydrated_snaps = _.flatten(hydrated_snaps);
                deferred.resolve(hydrated_snaps);
            }
        });
        return deferred; 
    },
    _loadStore: function(storeConfig){
        var deferred = Ext.create('Deft.Deferred');
        
        this.logger.log('_loadStore', storeConfig); 
        
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
                    this.logger.log('_loadStore load returned',records.length, success, records);
                    if (success) {
                        deferred.resolve(records);
                    } else {
                        deferred.resolve([]);
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

        var rb = this.down('#rb-time-box');
        console.log('>>>>>>>>>>>',rb)
        var find = {
                "Children": null,
                "_TypeHierarchy": type
            };
        
        if (this.getContext().getProjectScopeDown()){
            find["_ProjectHierarchy"] = {$in: [this.getContext().getProject().ObjectID]};
        } else {
            find["Project"]= this.getContext().getProject().ObjectID;
        }
        
        if(rb && rb.lastValue.timebox == 'I'){
            find["Iteration"] = { '$in': this.timebox_oids };
        }else if(rb && rb.lastValue.timebox == 'R'){
            find["Release"] = { '$in': this.timebox_oids };
        }


        var store_config ={
             find: find,
             fetch: fetch,
             hydrate: ['ScheduleState'],
             //compress: true,
             sort: {
                 _ValidFrom: 1
             },
             context: this.getContext().getDataContext()
        }
        this.logger.log('_getStoreConfig', store_config);
        return store_config;
    },
    _getFetchFields: function(){
        var field = this.down('#cb-field').getValue();
        var fetch_fields = ['ObjectID',field,'_TypeHierarchy','_SnapshotNumber','ScheduleState','FormattedID'];
        
        var filter_fields = [];  
        Ext.each(this.dataFilters, function(f){
            if (f.property != field){
                filter_fields.push(f.property);
            }
        },this);
        this.logger.log('_getFetchFields', Ext.Array.merge(fetch_fields,filter_fields));
        return Ext.Array.merge(fetch_fields,filter_fields);
    },
    _addArtifactToChoices: function(store){
        store.add({DisplayName:'Story/Defect',TypePath:['HierarchicalRequirement','Defect']});
    },
    /********************************************
    /* Overrides for App class
    /*
    /********************************************/
    //getSettingsFields:  Override for App    
    getSettingsFields: function() {
        var me = this;
        
        return [{
                name: 'percentileLineThreshold',
                xtype: 'rallynumberfield',
                minValue: 0,
                maxValue: 100,
                labelWidth: 225,
                margin: '10 0 10 10',
                fieldLabel: 'Percentile Line Threshold (%)',
                labelAlign: 'right'
            },{
                name: 'portfolioItemCycleStateFields',
                itemId: 'portfoliofields_box',
                xtype: 'rallyfieldpicker',
                modelTypes: ['PortfolioItem'],
                labelWidth: 225,
                fieldLabel: 'Valid Portfolio Item Cycle States',
                labelAlign: 'right',
                minWidth: 450,
                margin: '10 0 10 10',
                autoExpand: true,
                alwaysExpanded: false,
                storeConfig: {
                    context: {project: null}
                },
                listeners: {
                    ready: function (cb) {
                        cb.setValue(['State']);
                        cb.collapse();
                    }
                },
                readyEvent: 'ready'
            },{
                name: 'storyDefectCycleStateFields',
                itemId: 'storyfields_box',
                xtype: 'rallyfieldpicker',
                modelTypes: ['HierarchicalRequirement','Defect'],
                labelWidth: 225,
                fieldLabel: 'Valid User Story/Defect Cycle States',
                labelAlign: 'right',
                minWidth: 450,
                margin: '10 0 250 10',
                autoExpand: true,
                alwaysExpanded: false,
                storeConfig: {
                    context: {project: null}
                },
                listeners: {
                    ready: function (cb) {
                        cb.setValue(['ScheduleState']);
                        cb.collapse();
                    }
                },
                readyEvent: 'ready'
            }
        ];
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
    onSettingsUpdate: function (settings){
        this._addTypePicker();
    }
});