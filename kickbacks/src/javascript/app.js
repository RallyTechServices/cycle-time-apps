Ext.define("kickbacks-app", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'selector_box', layout: {type: 'hbox'}},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],

    dateRangeStore: [
        {name: 'Last Complete Month', value: -1},
        {name: 'Last 2 Complete Months', value: -2},
        {name: 'Last 3 Complete Months', value: -3},
        {name: 'Last 6 Complete Months', value: -6},
        {name: 'Last 12 Complete Months', value: -12}
    ],

    defaultDateRange: -3,

   launch: function() {
        this._addComponents();
   },
    _updateApp: function(){

        this._removeChart();
        this._fetchData();
    },
   _fetchData: function(){
      this.setLoading(true);
       var field = this._getField(),
           find = {
           "_TypeHierarchy": {$in: this._getArtifactType()},
           "_ValidTo": {$gte: Rally.util.DateTime.toIsoString(this._getFromDate())}
          },
          previousValueField = '_PreviousValues.' + field,
          fetch =  ['FormattedID','Name',field, previousValueField, 'Owner','_ValidFrom','_ValidTo','_TypeHierarchy'];

       if (this.getContext().getProjectScopeDown()){
           find["_ProjectHierarchy"] = this.getContext().getProject().ObjectID;
       } else {
           find["Project"] = this.getContext().getProject().ObjectID;
       }

       var hydrate = ["_TypeHierarchy","Owner"];
       if (field == 'ScheduleState'){
           hydrate.push(field);
       }

       var kb_store = Ext.create('Rally.data.lookback.SnapshotStore',{
           findConfig: find,
           fetch: fetch,
           hydrate: hydrate,
           removeUnauthorizedSnapshots: true
       });

       kb_store.load({
            scope: this,
            callback: this._kickbackStoreLoaded
       });
   },
   _kickbackStoreLoaded: function(records, operation, success) {
       this.logger.log('_kickbackStoreLoaded',records,operation,success);
       this.setLoading(false);
       if (!success){
           var msg = 'Failed to load data';
           if (operation.error && operation.error.errors){
               msg += ': ' + operation.error.errors[0];
           }
           Rally.ui.notify.Notifier.showError({message: msg});
           return;
       }

       var calc = Ext.create('Rally.technicalservices.KickbackCalculator', {
           kickbackField: this._getField(),
           kickbackPrecedence: this._getFieldPrecedence(),
           startDate: this._getFromDate(),
           endDate: new Date()
       });

       var chart_data = calc.runCalculation(records);
       this._addChart(chart_data);
       this._addGrid(calc.kickBackDataExport);
       //this.exportData = calc.export;
   },
    _addGrid: function(kickbackData){
        var store = Ext.create('Rally.data.custom.Store',{
            data: kickbackData,
            pageSize: kickbackData.length + 1
        });

        this.down('#display_box').add({
            xtype: 'rallygrid',
            itemId: 'rally-grid',
            store: store,
            showPagingToolbar: false,
            columnCfgs: [
                {dataIndex:'formattedID', text:'Formatted ID'},
                {dataIndex:'name', text:'Name', flex: 1},
                {dataIndex: 'lastState', text: 'Last State'},
                {dataIndex:'currentState', text:'Current State'},
                {dataIndex:'date', text: 'Date', flex: 1},
                {dataIndex:'deletion', text:'Deleted'}
            ]
        });

    },
    _removeChart: function(){
        if (this.down('#rally-chart')){
            this.down('#rally-chart').destroy();
            this.down('#rally-grid').destroy();
        }
    },
    _addChart: function(chartData){
       this._removeChart();
       this.down('#display_box').add({
            xtype: 'tskickbackchart',
            itemId: 'rally-chart',
            chartData: chartData,
            title: 'Kickbacks and Deletions'
        });
    },
    _getField: function(){
        return this.down('#cb-field').getValue() || null;
    },
    _getFieldPrecedence: function(){
        var allowedValues =  this.down('#cb-field').getRecord().get('fieldDefinition').attributeDefinition.AllowedValues;
        return _.map(allowedValues, function(av){return av.StringValue});
    },
    _getArtifactType: function(){
        var types = this.down('#cb-artifact-type').getValue() || [];
        if (!_.isArray(types)){
            return [types];
        }
        return types;
    },
    _getFromDate: function(){
        var monthsBack =  this.down('#cb-date-range').getValue();
        return Rally.util.DateTime.add(new Date(),"month",monthsBack);
    },
    _addComponents: function(){

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

        var objTypeFilters = [
            {property:'TypePath', operator: 'contains', value: 'PortfolioItem/'},
            {property:'TypePath', value: 'Defect'},
            {property:'TypePath', value: 'HierarchicalRequirement'}
        ];

        this.down('#selector_box').add({
            xtype: 'rallycombobox',
            autoExpand: true,
            itemId: 'cb-artifact-type',
            storeConfig: {
                model: 'TypeDefinition',
                filters: Rally.data.wsapi.Filter.or(objTypeFilters),
                autoLoad: true,
                listeners: {
                    load: function(store){
                        var rec = store.findExactRecord('DisplayName','User Story/Defect');
                        if (rec == null){
                            store.add({
                                TypePath: ['HierarchicalRequirement', 'Defect'],
                                DisplayName: 'User Story/Defect'
                            });
                        }
                    }
                }
            },
            displayField: 'DisplayName',
            valueField: 'TypePath',
            fieldLabel: 'Artifact Type',
            labelAlign: 'right',
            minWidth: 300,
            labelWidth: 100,
            margin: 10,
            listeners: {
                scope: this,
                ready: this._updateFieldPicker,
                select: this._updateFieldPicker
            }
        });
    },
    _updateFieldPicker: function(cb){
        var types = this._getArtifactType();

        if (this.down('#cb-field')){
            this.down('#cb-field').destroy();
            this.down('#bt-update').destroy();
        }

        this.down('#selector_box').add({
            xtype: 'tsdropdownfieldcombobox',
            itemId: 'cb-field',
            margin: 10,
            fieldLabel: 'Field',
            labelAlign: 'right',
            model: types[0]
        });

        this.down('#selector_box').add({
            xtype: 'rallybutton',
            itemId: 'bt-update',
            scope: this,
            text: 'Update',
            margin: 10,
            handler: this._updateApp
        });
    }
});
