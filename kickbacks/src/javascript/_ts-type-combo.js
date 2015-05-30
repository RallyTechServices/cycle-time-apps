Ext.define('Rally.technicalservices.DropdownFieldCombobox', {
    requires: [],
    extend: 'Rally.ui.combobox.ComboBox',
    alias: 'widget.tsdropdownfieldcombobox',

    config: {
        /**
         * @cfg {Rally.data.Model/String} model (required) The model containing the specified field used to populate the store.
         * Not required if field is an instance of {Rally.data.Field}.
         */
        model: undefined,

        /**
         * @cfg {Object} context An object specifying the scoping settings for retrieving the specified model
         * If not specified the values provided by {Rally.env.Environment#getContext} will be used.
         */
        context: undefined,

        queryMode: 'local',
        editable: false,
        valueField: 'value',
        displayField: 'name',
        lastQuery: ''
    },

    /**
     * @constructor
     */
    constructor: function(config) {

        this.mergeConfig(config);

        this.store = Ext.create('Ext.data.Store', {
            fields: [this.valueField, this.displayField, 'fieldDefinition'],
            data: []
        });

        return this.callParent([this.config]);
    },

    initComponent: function() {

        this.callParent(arguments);

        this.on('afterrender', this._onAfterRender, this);

        if (this.model) {
            if (Ext.isString(this.model)) {
                this._fetchModel();
            } else {
                this._populateStore();
            }
        }
    },

    findRecordByValue: function(value) {
        var record = this.findRecord(this.valueField, value);

        if (!record && (value || '').indexOf('c_') !== 0) {
            record = this.findRecord(this.valueField, 'c_' + value);
        }

        return record;
    },

    _fetchModel: function() {
        Rally.data.ModelFactory.getModel({
            context: this.context,
            type: this.model,
            success: this._onModelRetrieved,
            scope: this
        });
    },

    _onModelRetrieved: function(model) {
        this.model = model;
        this._populateStore();
    },

    _populateStore: function() {
        if (!this.store) {
            return;
        }
        var data = _.sortBy(
            _.map(
                _.filter(this.model.getFields(), this._isNotHidden),
                this._convertFieldToLabelValuePair,
                this
            ),
            'name'
        );

        this.store.loadRawData(data);
        this.setDefaultValue();
        this.onReady();
    },

    _isNotHidden: function(field) {
        var attributeTypes = ['STRING','STATE','RATING'];

        //Only allow State field for portfolio item types
        if (/portfolioitem/.test(field.modelType)){
            return field.name == 'State';
        }

        if (!field.hidden && !field.ReadOnly &&
            field.attributeDefinition && field.attributeDefinition.Constrained &&
            (field.name == 'ScheduleState' || field.name == 'State' || /c_KanbanProcess/.test(field.name))){
            return true;
        }
        return false;
    },

    _convertFieldToLabelValuePair: function(field) {
        var pair = {
            fieldDefinition: field
        };
        pair[this.valueField] = field.name;
        pair[this.displayField] = field.displayName;
        return pair;
    },

    _onAfterRender: function() {
        this._afterRender = true;
        if (this._storeLoaded) {
            this.fireEvent('ready', this);
        }
    },

    onReady: function() {
        this._storeLoaded = true;
        if (this._afterRender) {
            this.fireEvent('ready', this);
        }
    },

    refreshWithNewModelType: function(type) {
        this.model = type;
        this._fetchModel();
    }
});