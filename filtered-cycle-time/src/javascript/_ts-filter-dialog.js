Ext.define('Rally.technicalservices.dialog.Filter',{
    extend: Rally.ui.dialog.Dialog,
    autoShow: true,
    componentCls: "rly-popover dark-container",
    validFields: [],
    initComponent: function() {
        this.items = this._getItems();
        this.buttons = this._getButtonConfig();
        this.callParent(arguments);
        this._addNewRow();
        this.addEvents(
                'customFilter'
        );
    },
    _getItems: function() {
        return [{
            xtype: "container",
            cls: "custom-filter-header",
            layout: "column",
            defaults: {
                xtype: "component",
                cls: "filter-panel-label"
            },
            items: [{
                height: 1,
                width: 30
            }, {
                html: "Field",
                width: 155
            }, {
                html: "Operator",
                width:  80
            }, {
                html: "Value",
                width:  155
            }]
        }, {
            xtype: "container",
            itemId: "customFilterRows"
        },{
            xtype: "container",
            itemId: 'ct-footer',
            items: [{
                xtype:'rallybutton',
                text: '+',
                margin: 5,
                scope: this,
                handler: this._addNewRow
            }]
        }]
    },
    _getFieldStore: function(){
        //Return a store that includes filterable fields but
        //excludes the field 
        return Ext.create('Rally.data.custom.Store',{
            data: this.validFields
        });
    },
    _getOperatorStore: function(ct){
        console.log('bubble',ct);
        if (ct && ct.itemId && ct.itemId == 'ct-row'){
            var operator_store = ["="];
            var rec = ct.down('#cb-filter-field').getRecord(); 
            ct.down('#cb-filter-operator').destroy(); 
            ct.down('#cb-filter-value').destroy(); 
            console.log('attributetype', ct.down('#cb-filter-field').getRecord().get('RealAttributeType'));
            if (ct.down('#cb-filter-field').getRecord().get('AttributeType') == 'QUANTITY'){
                 operator_store = ["=",">","<",">=","<="];
                 
                 ct.add({
                     xtype: "rallycombobox",
                     itemId: 'cb-filter-operator',
                     store: operator_store,
                     margin: 5,
                     width: 80,
                     allowNoEntry: true,
                     noEntryText: ''
                 });
                 ct.add({
                     xtype: "rallynumberfield",
                     itemId: 'cb-filter-value',
                     margin: 5,
                     width: 80,
                     allowBlank: true,
                     
                 });
            } else {
                ct.add({
                    xtype: "rallycombobox",
                    itemId: 'cb-filter-operator',
                    store: operator_store,
                    margin: 5,
                    width: 80,
                    allowNoEntry: true,
                    noEntryText: '',
                    noEntryValue: null
                    
                });

                ct.add({
                    xtype: 'rallyfieldvaluecombobox',
                    itemId: 'cb-filter-value',
                    model: 'HierarchicalRequirement',
                    field: rec.get('ElementName'),
                    margin: 5,
                    allowNoEntry: true,
                    noEntryText: '',
                    noEntryValue: null
                });
               
            }
             

        }
    },
    _addNewRow: function() {

        var field_store = this._getFieldStore();
        
        this.down('#customFilterRows').add({
            xtype: "container",
            layout: {type: 'hbox'},
            itemId: 'ct-row',
            items: [{
                xtype: "rallybutton",
                text: '-',
                scope: this,
                margin: 5
            },{
                xtype: "rallycombobox",
                itemId: 'cb-filter-field',
                store: field_store,
                valueField: 'ElementName',
                listeners: {
                    scope: this,
                    select: function(cb){
                        cb.bubble(this._getOperatorStore)
                    }
                },
                allowNoEntry: true,
                noEntryText: 'Choose Field...',
                noEntryValue: null,
                margin: 5,
                value: null
            },{
                xtype: "rallycombobox",
                itemId: 'cb-filter-operator',
                store: [],
                margin: 5,
                width: 80
            },{
                xtype: "rallycombobox",
                itemId: 'cb-filter-value',
                store: [],
                margin: 5
            }],
        })
    },
    _getButtonConfig: function() {
        return [{
            xtype: "rallybutton",
            itemId: "cancelButton",
            cls: "secondary rly-small",
            text: "Cancel",
            handler: this._onCancelClick,
            scope: this
        }, {
            xtype: "rallybutton",
            itemId: "applyButton",
            cls: "primary rly-small",
            text: "Apply",
            handler: this._onApplyClick,
            scope: this
        }]
    },
    _onCancelClick: function() {
        this.destroy()
    },
    _validateItem: function(item){
        return true;  
    },
    _onApplyClick: function() {
        var filters = [];  
        console.log(this.down('#customFilterRows').down('ct-row'));
        Ext.each(this.down('#customFilterRows').items.items, function(item){
             if (this._validateItem(item)){
                 console.log('item',item);
                 property = item.down('#cb-filter-field').getValue();
                 operator = item.down('#cb-filter-operator').getValue();
                 val = item.down('#cb-filter-value').getValue(); 
                 
                 if (property && operator && val) {
                     filters.push({
                         property: property,
                         operator: operator,
                         value: val
                     });
                 }
                 
             }
        }, this);

        this.fireEvent("customfilter", filters);
        this.destroy()
    },
});