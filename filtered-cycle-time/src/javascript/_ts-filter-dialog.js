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
            layout: {type: 'hbox'},
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
            itemId: "ct-rows",
            layout: {type: 'vbox'}
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
    _initializeSelectedFilters: function(){
         
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
        if (ct && ct.itemId && ct.itemId.match(/^ct-row-/)){
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
                     allowNoEntry: false,
                     noEntryText: '',
                     listeners: {
                         scope: this,
                         change: function(cb){
                             cb.bubble(this._validateFilters, this)
                         }
                     }
                 });
                 ct.add({
                     xtype: "rallynumberfield",
                     itemId: 'cb-filter-value',
                     margin: 5,
                     width: 80,
                     allowBlank: false,
                     listeners: {
                         scope: this,
                         change: function(cb){
                             cb.bubble(this._validateFilters, this)
                         }
                     }
                 });
            } else {
                ct.add({
                    xtype: "rallycombobox",
                    itemId: 'cb-filter-operator',
                    store: operator_store,
                    margin: 5,
                    width: 80,
                    allowNoEntry: false,
                    listeners: {
                        scope: this,
                        change: function(cb){
                            cb.bubble(this._validateFilters, this)
                        }
                    }
                });

                ct.add({
                    xtype: 'rallyfieldvaluecombobox',
                    itemId: 'cb-filter-value',
                    model: 'HierarchicalRequirement',
                    field: rec.get('ElementName'),
                    margin: 5,
                    allowNoEntry: false,
                    listeners: {
                        scope: this,
                        change: function(cb){
                            cb.bubble(this._validateFilters,this)
                        }
                    }
                });
               
            }
             

        }
    },
    _addNewRow: function() {

        var field_store = this._getFieldStore();
        var row_num = this.down('#ct-rows').items.length;
        var item_id = 'ct-row-' + row_num;
        console.log(row_num);
        
        var row = Ext.create('Ext.Container',{
            layout: {type: 'hbox'},
            itemId: item_id,
            items: [{
                xtype: "rallybutton",
                text: '-',
                scope: this,
                margin: 5,
                handler: function(btn){
                    btn.bubble(this._removeRow, this);
                }
            },{
                xtype: "rallycombobox",
                itemId: 'cb-filter-field',
                store: field_store,
                displayField: 'Name',
                valueField: 'ElementName',
                listeners: {
                    scope: this,
                    select: function(cb){
                        cb.bubble(this._getOperatorStore, this)
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
                width: 80,
                listeners: {
                    scope: this,
                    change: function(cb){
                        cb.bubble(this._validateFilters, this)
                    }
                }
            },{
                xtype: "rallycombobox",
                itemId: 'cb-filter-value',
                store: [],
                margin: 5,
                listeners: {
                    scope: this,
                    change: function(cb){
                        cb.bubble(this._validateFilters, this)
                    }
                }
            }],
            
        });
        this.down('#ct-rows').add(row);
        this._validateFilters(this.down('#ct-rows'));
    },
    _removeRow: function(ct){
        if (ct && ct.itemId && ct.itemId.match(/^ct-row-/)){
            ct.destroy();
        }  
        this._validateFilters(this.down('#ct-rows'));

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
            scope: this,
            disabled: true 
        }]
    },
    _onCancelClick: function() {
        this.destroy()
    },
    _validateFilters: function(ct){
        console.log('_validateFilters');
        var disabled = false; 
        if (ct && ct.itemId && ct.itemId.match(/^ct-rows/)){
            if (this.down('#ct-rows').items.items.length == 0){
                disabled = true; 
            }
            Ext.each(this.down('#ct-rows').items.items, function(item){
                var property = item.down('#cb-filter-field').getValue();
                var operator = item.down('#cb-filter-operator').getValue();
                var val = item.down('#cb-filter-value').getValue(); 
                
                if (property == null || operator == null || property.length == 0 || operator.length == 0){
                    disabled = true;  
                }
                if (item.down('#cb-filter-value').xtype == 'rallynumberfield'){
                    if (val == null || val.toString.length == 0){
                        disabled = true;
                    }
                }
            }, this);
            this.down('#applyButton').setDisabled(disabled);
        }
    },
    _onApplyClick: function() {
        var filters = [];  
        Ext.each(this.down('#ct-rows').items.items, function(item){
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
        }, this);

        this.fireEvent("customfilter", filters);
        this.destroy()
    },
});