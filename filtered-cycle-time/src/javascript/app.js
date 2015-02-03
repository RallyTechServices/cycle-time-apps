Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'selector_box', layout: {type: 'hbox'}},
    //    {xtype:'container',itemId:'filter_box', layout: {type: 'vbox'}, title: 'Filter by', border: 1, style: {borderColor: 'gray', borderStyle: 'solid'}},
        {xtype:'container',itemId:'display_box'},
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
    launch: function() {
        this._fetchCycleAndFilterableFields().then({
            scope: this,
            success: function(){
                this.logger.log('Valid fields for cycle and filter time', this.cycleFields, this.filterFields); 
                this._initializeApp(this.cycleFields);
            }
        });
    },
    _initializeApp: function(validFields){
        
        var field_store = Ext.create('Rally.data.custom.Store',{
            data: validFields
        });
        this.logger.log('_initializeApp', validFields);
        
        var cb = this.down('#selector_box').add({
            xtype: 'rallycombobox',
            itemId: 'cb-field',
            store: field_store, 
            valueField: 'ElementName',
            displayField: 'Name',
            fieldLabel:  'Field',
            labelAlign: 'right',
            labelWidth: 50,
            margin: 10,
            scope: this,
            listeners: {
                scope: this,
                select: this._updateDropdowns
            }
        });
     //   this._addFilter(validFields);
        
        cb.setValue(this.defaultField);
        this._updateDropdowns(cb);
    },
    _getGroupPrecedence: function(){
        var data = this.down('#cb-from-state').getStore().data;
        var group = [];  
        Ext.each(data.items,function(rec){
            group.push(rec.get('value'));
        });
        this.logger.log('_getGroupPrecedence',group);
        return group;  
    },
    _fetchCycleAndFilterableFields: function(){
        var deferred = Ext.create('Deft.Deferred');
        var allowed_attribute_types = ['STATE','STRING'];
        var additional_filterable_fields = ['PlanEstimate'];
        var valid_fields = [];
        var filter_fields = [];
        /**
         * Right now, this is only getting fields from a story type, but 
         * we need to load fields from a defect type, too.
         */
        var filters = Ext.create('Rally.data.wsapi.Filter',{
            property: 'TypePath',
            value: 'HierarchicalRequirement'
        });
        Ext.create('Rally.data.wsapi.Store',{
            model:  'TypeDefinition',
            filters: filters,
            autoLoad: true,
            fetch: ['Attributes','Name'],
            listeners: {
                scope: this, 
                load: function(store,records,success){
                    this.logger.log('TypeDefinitions loaded success', success, store, records);
                    var attributeStore = records[0].getCollection('Attributes').load({
                        fetch: ['AttributeType','Constrained','Name','ElementName','AllowedQueryOperators', 'RealAttributeType','Type','VisibleOnlyToAdmins','ReadOnly','AllowedValues'],
                        autoLoad: true, 
                        scope: this,
                        callback: function(records, operation, success){
                            this.logger.log('Attributes loaded success',success, operation, records);
                            Ext.each(records, function(rec){
                                var data = rec.getData();
                                if ((data.Constrained  && Ext.Array.contains(allowed_attribute_types, data.AttributeType) && data.ReadOnly == false)){
                                    filter_fields.push(rec);
                                    valid_fields.push(rec);
                                } else {
                                    if (Ext.Array.contains(additional_filterable_fields, data.ElementName)){
                                        filter_fields.push(rec);
                                    }
                                }
                            });
                            this.filterFields = filter_fields;  
                            this.cycleFields = valid_fields; 
                            deferred.resolve();
                        }
                    });
                }
            }
        });
        return deferred;  
    },
    _updateDropdowns: function(cb){
        
        if (this.down('#cb-from-state')){
            this.down('#cb-from-state').destroy();
            this.down('#cb-to-state').destroy();
            this.down('#cb-granularity').destroy();
            this.down('#btn-update').destroy();
            this.down('#btn-filter').destroy();
        }
        
        var field = cb.getValue(); 
        this.down('#selector_box').add({
            xtype: 'rallyfieldvaluecombobox',
            itemId: 'cb-from-state',
            model: 'HierarchicalRequirement',
            field: field,
            allowNoEntry: true,
            noEntryText: '-- Artifact Creation --',
            noEntryValue: null,
            fieldLabel:  'Start',
            labelAlign: 'right',
            labelWidth: 50,
            margin: 10
        });
        
        this.down('#selector_box').add({
            xtype: 'rallyfieldvaluecombobox',
            itemId: 'cb-to-state',
            model: 'HierarchicalRequirement',
            field: field,
            fieldLabel:  'End',
            labelAlign: 'right',
            labelWidth: 50,
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
            labelWidth: 75,
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
    _getGranularityRecord: function(){
        this.logger.log('_getGranularity', this.down('#cb-granularity').getValue());
        return this.down('#cb-granularity').getRecord();
    },
    _createChart: function(){
        var field = this.down('#cb-field').getValue();
        var granularity_rec = this._getGranularityRecord();
        var granularity = granularity_rec.get('value');  
        var title_text = 'Average Cycle Time from ' + this._getStartState() + ' to ' + this._getEndState();
        var tick_interval = granularity_rec.get('tickInterval');  
        var end_date = new Date(); 
        var start_date = Rally.util.DateTime.add(new Date(),"month",-12);
        var start_state = this._getStartState();
        this.logger.log('_createChart', field, start_state, this._getEndState(), granularity, start_date, end_date);
        
//        if (!this._validateSelectedStates()){
//            alert('The From State must come before the To State.');
//            return;
//        }
        
        if (this.down('#rally-chart')){
            this.down('#rally-chart').destroy();
        }
        
        this.down('#display_box').add({
            xtype: 'rallychart',
            itemId: 'rally-chart',
            calculatorType: 'CycleCalculator',
            storeType: 'Rally.data.lookback.SnapshotStore',
            storeConfig: this._getStoreConfig(start_state),
            calculatorConfig: {
                cycleField: field,
                cycleStartValue: start_state,
                cycleEndValue: this._getEndState(),
                cyclePrecedence: this._getGroupPrecedence(),
                startDate: start_date,
                endDate: end_date,
                granularity: granularity,
                dateFormat: granularity_rec.get('dateFormat'),
                filters: []
            }, 
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
                        marker: {
                            enabled: false
                        }
                    },
                    line: {
                        connectNulls: true
                    }
                },
            }
        });
    },
    _getStoreConfig: function(){
        var start_state = this._getStartState();
        var end_state = this._getEndState(); 
        
        var field = this.down('#cb-field').getValue();
        var prev_field = Ext.String.format('_PreviousValues.{0}', field);
        var fetch = this._getFetchFields();

        var start_date = Rally.util.DateTime.add(new Date(), "Month", -12);
        
        var find = {
                "Children": null,
                "_TypeHierarchy": {$in: ['HierarchicalRequirement','Defect']}
            };
        
        if (this.getContext().getProjectScopeDown()){
            find["_ProjectHierarchy"] = {$in: [this.getContext().getProject().ObjectID]};
        } else {
            find["Project"] = this.getContext().getProject().ObjectID;
        }
        
        var store_config = {
             find: find,
             fetch: fetch,
             hydrate: ['ScheduleState', '_TypeHierarchy'],
             compress: true,
             sort: {
                 _ValidFrom: 1
             },
             context: this.getContext().getDataContext(),
             limit: 'Infinity',
             removeUnauthorizedSnapshots: true
         };

        return store_config;
    },
    _getFetchFields: function(){
        var field = this.down('#cb-field').getValue();
        var prev_field = Ext.String.format('_PreviousValues.{0}', field);
        var fetch_fields = ['ObjectID',field,prev_field,'_TypeHierarchy','_SnapshotNumber'];
        
        var filter_fields = [];  
        Ext.each(this.filterFields, function(f){
            if (f.get('ElementName') != field){
                filter_fields.push(f.get('ElementName'));
            }
        },this);
        
        return Ext.Array.merge(fetch_fields,filter_fields);
    },
    _filter: function(){
        Ext.create('Rally.technicalservices.dialog.Filter',{
            validFields: this.filterFields,
            listeners: {
                scope: this,
                customFilter: function(filters){
                    this.logger.log('_filter event fired',filters);
                    
                }
            }
        });
        
    }
});