Ext.define("kickbacks-app", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'settings_box'},
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
    config: {
        defaultSettings: {
            threshhold:  300
        }
    },
   launch: function() {
       if (this.isExternal()){
           this.showSettings(this.config);
       } else {
           this.onSettingsUpdate(this.getSettings());  //(this.config.type,this.config.pageSize,this.config.fetch,this.config.columns);
       }
   },
    _updateApp: function(){

        this._removeChart();
        this._fetchData();
    },
   _fetchData: function(){
      this.setLoading(true);
       var field = this._getField(),
           find = {
           "_TypeHierarchy": this._getArtifactType(),
           "_ValidTo": {$gte: Rally.util.DateTime.toIsoString(this._getFromDate())}
          },
          previousValueField = '_PreviousValues.' + field,
          fetch =  ['FormattedID','Name',field, previousValueField, 'Owner','_ValidFrom','_ValidTo','_UnformattedID'];

       if (this.getContext().getProjectScopeDown()){
           find["_ProjectHierarchy"] = this.getContext().getProject().ObjectID;
       } else {
           find["Project"] = this.getContext().getProject().ObjectID;
       }

       var hydrate = ["Owner"];
       if (field == 'ScheduleState' || field == 'State'){
           hydrate.push(field);
           hydrate.push(previousValueField);
       }

       var kb_store = Ext.create('Rally.data.lookback.SnapshotStore',{
           findConfig: find,
           fetch: fetch,
           hydrate: hydrate,
           removeUnauthorizedSnapshots: true,
           limit: 'Infinity'
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

       var current = [],
           all = [],
           now = new Date();

       _.each(records, function(r){
           var obj_id = r.get('ObjectID');
           if (!Ext.Array.contains(all, obj_id)){
               all.push(obj_id);
           }
           var valid_to = Rally.util.DateTime.fromIsoString(r.get('_ValidTo'));
           if (valid_to > now){
               current.push(obj_id);
           }
       });

        //get disappearances
       this.setLoading('Loading current items...');

        var disappearing_oids = _.difference(all, current);
        this._findCurrentItems(_.clone(disappearing_oids)).then({
            scope: this,
            success: function(currentRecords) {
                this.setLoading(false);
                this.logger.log('_findCurrentItems', currentRecords);
                var current_oids = _.map(currentRecords, function (r) {
                    return r.get('ObjectID');
                });
                var missing_oids = _.difference(disappearing_oids, current_oids);

                var calc = Ext.create('Rally.technicalservices.KickbackCalculator', {
                    missingOids: missing_oids,
                    kickbackField: this._getField(),
                    kickbackPrecedence: this._getFieldPrecedence(),
                    startDate: this._getFromDate(),
                    endDate: new Date(),
                    kickbackThreshholdInSeconds: this.threshhold
                });
                var chart_data = calc.runCalculation(records);
                this._addChart(chart_data);
                this._addGrid(calc.kickBackDataExport);
            },
            failure: function(errorMsg){
                this.setLoading(false);
            }
        });
 },
    _findCurrentItems: function(oids){
        var deferred = Ext.create('Deft.Deferred');

        var chunker = Ext.create('Rally.technicalservices.data.Chunker',{
            fetch: ['ObjectID','FormattedID'],
            find: {
                __At: "current"
            },
            chunkField: "ObjectID",
            chunkOids: oids
        });

        chunker.load().then({
            scope: this,
            success: function(data){
                deferred.resolve(data);
            },
            failure: function(errorMsg){
                deferred.reject(errorMsg);
            }
        });
        return deferred;
    },
    _addGrid: function(kickbackData){

        var store = Ext.create('Rally.data.custom.Store',{
            data: kickbackData,
            pageSize: kickbackData.length + 1
        });

        this.down('#display_box').add({
            xtype: 'container',
            itemId: 'ct-label',
            style: { textAlign: 'right', color: 'gray'},
            flex: 1,
            html: '<i>' + kickbackData.length + ' kickbacks and deletions found.</i>'
        });

        this.down('#display_box').add({
            xtype: 'rallygrid',
            itemId: 'rally-grid',
            store: store,
            showPagingToolbar: false,
            showRowActionsColumn: false,
            columnCfgs: [
                {dataIndex:'formattedID', text:'Formatted ID'},
                {dataIndex:'name', text:'Name', flex: 1},
                {dataIndex:'lastState', text: 'Original State'},
                {dataIndex:'currentState', text:'Changed-to State'},
                {dataIndex:'date', text: 'Date', flex: 1},
                {dataIndex:'deletion', text:'Deleted'}
            ]
        });
       this.down('#bt-export').setDisabled(false);
    },

    _removeChart: function(){
        if (this.down('#rally-chart')){
            this.down('#rally-chart').destroy();
            this.down('#rally-grid').destroy();
            this.down('#ct-label').destroy();
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
        return this.down('#cb-artifact-type').getValue() || '';
    },
    _getFromDate: function(){
        var monthsBack =  this.down('#cb-date-range').getValue();
        return Rally.util.DateTime.add(new Date(),"month",monthsBack);
    },
    _export: function(){
        var grid = this.down('#rally-grid');
        var csv = Rally.technicalservices.FileUtilities.getCSVFromGrid(grid);
        Rally.technicalservices.FileUtilities.saveAs(csv, 'export.csv');

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
                autoLoad: true
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
        var type = this._getArtifactType();

        if (this.down('#cb-field')){
            this.down('#cb-field').destroy();
            this.down('#bt-update').destroy();
            this.down('#bt-export').destroy();
        }

        this.down('#selector_box').add({
            xtype: 'tsdropdownfieldcombobox',
            itemId: 'cb-field',
            margin: 10,
            fieldLabel: 'Field',
            minWidth: 225,
            labelWidth: 50,
            labelAlign: 'right',
            model: type
        });

        this.down('#selector_box').add({
            xtype: 'rallybutton',
            itemId: 'bt-update',
            scope: this,
            text: 'Update',
            margin: 10,
            handler: this._updateApp
        });

        this.down('#selector_box').add({
            xtype: 'rallybutton',
            itemId: 'bt-export',
            scope: this,
            text: 'Export',
            disabled: true,
            margin: 10,
            handler: this._export
        });
    },
    /********************************************
     /* Overrides for App class
     /*
     /********************************************/
    //getSettingsFields:  Override for App
    getSettingsFields: function() {
        var me = this;

        return [
            {
                name: 'threshhold',
                xtype: 'rallynumberfield',
                fieldLabel: 'Kickback threshold (seconds)',
                labelWidth: 200,
                labelAlign: 'right',
                minValue: 0
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
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        Ext.apply(this, settings);
        this._addComponents();
    }
});
