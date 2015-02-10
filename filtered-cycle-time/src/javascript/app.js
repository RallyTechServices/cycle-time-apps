Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'selector_box', layout: {type: 'hbox'}},
    //    {xtype:'container',itemId:'filter_box', layout: {type: 'vbox'}, title: 'Filter by', border: 1, style: {borderColor: 'gray', borderStyle: 'solid'}},
        {xtype:'container',itemId:'display_box'},
        {xtype:'container',
            itemId:'filter_box',
            padding: 10, 
            margin: 10,
            tpl:'<div class="ts-filter"><b>Applied Filters:</b><br><tpl for=".">{displayProperty} {operator} {value}<br></tpl></div>'},
        {xtype:'tsinfolink'}
    ],
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
        this._fetchFields().then({
            scope: this,
            success: function(){
                this.logger.log('Valid fields for cycle and filter time', this.cycleFields, this.filterFields); 
                this._initializeApp(this.cycleFields);
            }
        });

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
            margin: 10,
            scope: this,
            listeners: {
                scope: this,
                select: this._updateDropdowns,
                ready: function(cb){
                    cb.setValue(this.defaultField);
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
     _fetchFields: function(){
         var deferred = Ext.create('Deft.Deferred');
         
         var allowed_attribute_types = ['STATE','STRING'];
         var additional_filterable_fields = ['PlanEstimate'];
         var valid_fields = [];
         var filter_fields = [];
         
         var promises = [this._fetchModelFields('HierarchicalRequirement'),this._fetchModelFields('Defect')];
         Deft.Promise.all(promises).then({
             scope: this,
             success: function(fields){
                 fields = _.flatten(fields);
                 this.logger.log('_fetchFields success', fields);
                 var field_names = [];
                 Ext.each(fields, function(f){
                     if (f.hidden === false && f.attributeDefinition){
                         var attr_def = f.attributeDefinition;
                        if (!Ext.Array.contains(field_names, attr_def.ElementName)){
                             if (attr_def.Constrained && Ext.Array.contains(allowed_attribute_types, attr_def.AttributeType) && attr_def.ReadOnly == false){
                                 field_names.push(attr_def.ElementName);
                                 filter_fields.push(f);
                                 valid_fields.push(f);
                             } else {
                                 if (Ext.Array.contains(additional_filterable_fields, attr_def.ElementName)){
                                     filter_fields.push(f);
                                 }
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
        }
       
        var field = cb.getValue();
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
            labelWidth: 60,
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
            labelWidth: 85,
            width: 250,
            value: this.defaultDateRange,
            margin: 10
        });
        
        
        this.down('#selector_box').add({
            xtype: 'rallybutton',
            itemId: 'btn-update',
            text: 'Update',
            scope: this,
            margin: 10,
            handler: this._createChart
        });
        
        this.down('#selector_box').add({
            xtype: 'rallybutton',
            itemId: 'btn-filter',
            scope: this,
            text: 'Filter',
            margin: 10,
            handler: this._filter
        });
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
        
        this.logger.log('_createChart', field, start_state, this._getEndState(), granularity, start_date, end_date);
        
//        if (!this._validateSelectedStates()){
//            alert('The From State must come before the To State.');
//            return;
//        }

        this.setLoading('Fetching data...');
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
            }
        });
    },
    _drawChart: function(chart_data){
        this.logger.log('_drawChart');
        
        if (this.down('#rally-chart')){
            this.down('#rally-chart').destroy(); 
        }

        var granularity_rec = this.down('#cb-granularity').getRecord();
        var title_text = 'Average Cycle Time from ' + (this._getStartState() || '(None)') + ' to ' + this._getEndState();
        var tick_interval = granularity_rec.get('tickInterval');  
        
        this.down('#display_box').add({
            xtype: 'rallychart',
            itemId: 'rally-chart',
            chartData: chart_data, 
            loadMask: false,
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
                            text: 'Days'
                        },
                        min: 0
                    }
                ],
                plotOptions: {
                    series: {
                        dataLabels: {
                            format: '{y:,.1f}'
                        },
                        marker: {
                            enabled: false,
                        }
                    },
                    line: {
                        connectNulls: true,
                    }
                },
            }
        });        
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
        var find = {
                "Children": null,
                "_TypeHierarchy": type
            };
        
        if (this.getContext().getProjectScopeDown()){
            find["_ProjectHierarchy"] = {$in: [this.getContext().getProject().ObjectID]};
        } else {
            find["Project"]= this.getContext().getProject().ObjectID;
        }
        var store_config ={
             find: find,
             fetch: fetch,
             hydrate: ['ScheduleState'],
             //compress: true,
             sort: {
                 _ValidFrom: 1
             },
             context: this.getContext().getDataContext(),
        }
        this.logger.log('_getStoreConfig', store_config);
        return store_config;
    },
    _getFetchFields: function(){
        var field = this.down('#cb-field').getValue();
        var fetch_fields = ['ObjectID',field,'_TypeHierarchy','_SnapshotNumber','ScheduleState'];
        
        var filter_fields = [];  
        Ext.each(this.dataFilters, function(f){
            if (f.property != field){
                filter_fields.push(f.property);
            }
        },this);
        this.logger.log('_getFetchFields', Ext.Array.merge(fetch_fields,filter_fields));
        return Ext.Array.merge(fetch_fields,filter_fields);
    },

});