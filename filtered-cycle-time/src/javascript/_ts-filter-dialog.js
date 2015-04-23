Ext.define('Rally.technicalservices.dialog.Filter',{
    extend: Rally.ui.dialog.Dialog,
    logger: new Rally.technicalservices.Logger(),
    autoShow: true,
    componentCls: "rly-popover dark-container",
    validFields: [],
    app: null,
    initComponent: function() {
        this.items = this._getItems();
        this.buttons = this._getButtonConfig();
        this.callParent(arguments);
        this._initializeFilters(this.filters);
        this.addEvents(
                'customFilter'
        );
    },
    _initializeFilters: function(filters){
        this.logger.log('_initializeFilters', filters);
        
        if (filters && filters.length > 0){
            Ext.each(filters, function(filter){
                this._addNewRow(filter.property, filter.operator, filter.value);
            },this);
        } else {
            this._addNewRow();
        }
    },
    _getFieldStore: function(){
        var fields = []; 
        Ext.each(this.validFields, function(field){
            fields.push({
                name: field.name,
                displayName: field.displayName,
                attributeType: field.attributeDefinition.AttributeType,
                schemaType: field.attributeDefinition.SchemaType,
                modelType: field.modelType,
                isConstrained: field.attributeDefinition.Constrained  
            });
        },this);
        
        return Ext.create('Rally.data.custom.Store',{
            data: fields
        });
    },
    _addNewRow: function(property, operator, value) {
        this.logger.log('_addNewRow', property, operator, value);
        
        var field_store = this._getFieldStore();
        var items = [];  
        items.push({
            xtype: "rallybutton",
            itemId: 'btn-remove',
            text: '-',
            scope: this,
            margin: 5,
            handler: function(btn){
                btn.bubble(this._removeRow, this);
            }
        });

        items.push({
            xtype: "rallycombobox",
            itemId: 'cb-filter-field',
            store: field_store,
            displayField: 'displayName',
            valueField: 'name',
            listeners: {
                scope: this,
                select: function(cb){
                    this._updateFilterCombos(cb, operator, value);
                },
                ready: function(cb){
                    if (property) {
                        cb.setValue(property);
                        this._updateFilterCombos(cb,operator,value);
                    }
                }
            },
            allowNoEntry: true,
            noEntryText: 'Choose Field...',
            noEntryValue: null,
            margin: 5,
            value: null
        });
        
        var row = Ext.create('Ext.Container',{
            layout: {type: 'hbox'},
            items: items
            
        });
        this.down('#ct-rows').add(row);
        this._validateFilters();
    },
    _updateFilterCombos: function(cb, operator, value){
        var parent_ct = cb.up(null,1); 
        var rec = cb.getRecord(); 

        this.logger.log('_updateFilterCombos', cb.itemId, rec, operator, value);
        
        if (parent_ct){
            if (parent_ct.down('#cb-filter-operator')) {
                parent_ct.down('#cb-filter-operator').destroy(); 
                parent_ct.down('#cb-filter-value').destroy(); 
            }

            var op_val = operator || '=';
            var operator_ctl = this._getOperatorControl(rec, op_val, 'cb-filter-operator');
            parent_ct.add(operator_ctl);
            
            var value_val = value || null;
            var value_ctl = this._getValueControl(rec, value_val, 'cb-filter-value');
            parent_ct.add(value_ctl);

        }
    },

    _removeRow: function(btn){
        var ct = btn.up(null,1); 
        if (ct){
            ct.destroy();
        }  
        this._validateFilters();
    },
    _getButtonConfig: function() {
        return [{
            xtype: "rallybutton",
            itemId: "cancelButton",
            cls: "secondary rly-small",
            text: "Cancel",
            width: 90,
            handler: this._onCancelClick,
            scope: this
        }, {
            xtype: "rallybutton",
            itemId: "applyButton",
            cls: "primary rly-small",
            text: "Apply",
            width: 90,
            handler: this._onApplyClick,
            scope: this,
            disabled: true 
        }]
    },
    _onClearAll: function(){
        this.down('#ct-rows').removeAll(); 
        this._addNewRow();
    },
    _onCancelClick: function() {
        this.destroy()
    },
    _validateFilters: function(ct){
        var disabled = false; 
        var add_disabled = false; 
        
        var rows = this.down('#ct-rows').items.items;
        if (rows.length == 0){
            disabled = true; 
        }
        
        Ext.each(this.down('#ct-rows').items.items, function(item){
            item.down('#btn-remove').setDisabled(rows.length == 1);
            
            var property = null;  
            if (item.down('#cb-filter-field')){
                property = item.down('#cb-filter-field').getValue();
            }
            var operator = null;  
            if (item.down('#cb-filter-operator')){
                operator = item.down('#cb-filter-operator').getValue();
            }
            
            if (property == null || operator == null || property.length == 0 || operator.length == 0){
                disabled = true, add_disabled = true;  
            }
            
            var val = null;  
            if (item.down('#cb-filter-value')){
                val = item.down('#cb-filter-value').getValue() 
                if (item.down('#cb-filter-value').xtype == 'rallynumberfield'){
                    if (val == null || val.toString.length == 0){
                        disabled = true, add_disabled = true;
                    }
                }
            }; 
            if (rows.length == 1 && property == null && operator == null && val == null){
                disabled = false;   //clear filters 
            }
         }, this);
        this.logger.log('_validateFilters',disabled);
        this.down('#applyButton').setDisabled(disabled);
        this.down('#btn-add').setDisabled(add_disabled);
    },
    /* 
     * In some cases, we want to strip the value returned or make it look
     * different somehow.  (E.g., we want the preliminary estimate to just show the ID
     */
    _cleanValue: function(val) {
        if ( /\/preliminaryestimate\//.test(val)) {
            val = val.replace(/\/preliminaryestimate\//,"");
            val = parseInt(val,10);
        }
        if (/\/state\//.test(val)) {
            val = val.replace(/\/state\//,"")
            val = parseInt(val,10);
        }

                    
        return val;
    },
    _onApplyClick: function() {
        var filters = [];  
        Ext.each(this.down('#ct-rows').items.items, function(item){
            if (this.down('#cb-filter-operator')){
                var property = item.down('#cb-filter-field').getValue();
                var operator = item.down('#cb-filter-operator').getValue();
                var val = this._cleanValue( item.down('#cb-filter-value').getValue() ); 
                var display_property = item.down('#cb-filter-field').getRecord().get('displayName');
                var display_value = item.down('#cb-filter-value').displayValue || val;
                
                console.log("DISPLAY:", display_value);
                if (property && operator) {
                    filters.push({
                        property: property,
                        operator: operator,
                        value: val,
                        displayProperty: display_property,
                        displayValue: display_value
                    });
                }
            }
        }, this);

        this.fireEvent("customfilter", filters);
        this.destroy()
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
                itemId: 'clearButton',
                cls: "secondary rly-small",
                text: 'Clear All',
                width: 90,
                align: 'right',
                margin: '5 5 5 220',
                scope: this,
                handler: this._onClearAll
            },{
                xtype:'rallybutton',
                itemId: 'btn-add',
                text: 'Add New',
                width: 90,
                cls: "primary rly-small",
                align: 'right',
                
                margin: 5,
                scope: this,
                handler: this._addNewRow
            }]
        }]
    },
    _getOperatorControl: function(field, operatorValue, itemId){
        this.logger.log('_getOperatorControl',field, operatorValue);
        var operators = ['='];
        var operator_value = operatorValue || '=';
        //We should be able to get these back from the field, but its not consistent
        //so we are going to cheat and hardcode them
        if (!field.get('isConstrained')){
            switch(field.get('attributeType')){
                case 'STRING':
                case 'TEXT':
                    operators = ['=','contains'];
                    break;
                case 'DECIMAL':
                case 'INTEGER':
                case 'QUANTITY':
                    operators = ['=','<=','>=','<','>'];
                    break;  
                case 'DATE':
                    operators = ['on','before', 'after'];
            }
        }
        
        var op_ctl = {
            xtype: "rallycombobox",
            itemId: itemId,
            store: operators,
            margin: 5,
            width: 80,
            allowNoEntry: false,
            noEntryText: '',
            listeners: {
                scope: this,
                change: this._validateFilters,
                ready: function(cb){
                    cb.setValue(operator_value);
                }
            }
        };
        return op_ctl; 
    },
    _getValueControl: function(field, value, item_id){
        this.logger.log('_getValueControl',field)
        
        var ctl = {xtype: 'rallytextfield'};
        var type = field.get('attributeType');
        var hasAllowedValues = ((type == 'STATE') || (type=='RATING') || field.get('isConstrained'));
        var schema = field.get('schemaType');
        var field_name = field.get('name');
        var model_type = field.get('modelType');
        
        var app = this.app;
        
        switch(type){
            case 'BOOLEAN':  
                ctl = {
                    xtype: 'rallycombobox',
                    allowNoEntry: false,
                    store: ['true','false']
                };
                break;
            case 'DATE':
                ctl = {
                    xtype: 'rallydatefield',
                    allowNoEntry: false
                };
                break; 
            case 'TEXT':
            case 'STRING':
            case 'STATE':
            case 'RATING':
                if (hasAllowedValues){
                    ctl = {
                         xtype: 'rallyfieldvaluecombobox',
                         model: model_type,
                         field: field_name,
                         allowNoEntry: false
                    };
                }
                break;
            case 'OBJECT':
                //Release, Iteration, User, Project, artifact links
                if (schema == 'Iteration') {
                    ctl = {
                          xtype: 'rallyiterationcombobox',
                          allowNoEntry: false
                    };
                } else if (schema == 'Release') {
                    ctl = {
                        xtype: 'rallyreleasecombobox',
                        allowNoEntry: false
                    };
                } else if (schema == 'User') {
                  ctl = {
                        xtype: 'rallyusersearchcombobox',
                        project: app.getContext().getProject(),
                        allowNoEntry: false,
                        valueField: 'ObjectID'
                      };
                  } else if (schema == 'Project') {
                      ctl = {
                              xtype: 'rallyprojectpicker',
                              allowNoEntry: false
                      };
                    
                } else if ( (schema == 'State') || ( schema == 'PreliminaryEstimate' ) ) {
                    ctl = {
                        xtype: 'rallyfieldvaluecombobox',
                        prefix: Ext.util.Format.lowercase(schema),
                        model: model_type,
                        field: field_name,
                        allowNoEntry: false
                    };
                } 
                break;
            case 'DECIMAL':
            case 'INTEGER':
            case 'QUANTITY':
                ctl = {
                    xtype: 'rallynumberfield',
                    allowBlank: false
                }
        }
        _.extend(ctl, {
            itemId: item_id,
            margin: 5,
            listeners: {
                scope: this,
                change: function(cb) {
                    if ( cb.xtype == "rallyfieldvaluecombobox" ) {
                        cb.displayValue = cb.getRecord().get("name");
                    }
                    
                    if ( cb.xtype == "rallyusersearchcombobox" ) {
                        cb.displayValue = cb.getRecord().get("_refObjectName");
                    }
                    this._validateFilters();
                },
                ready: function(cb){
                    if (value){
                        cb.setValue(value);
                    }
                },
                render: function(cb){
                    if (value){
                        if (cb.xtype == "rallyusersearchcombobox") {
                            value = "/user/" + value;
                        }
                        if ( cb.prefix && value > 0 ) {
                            value = "/" + cb.prefix + "/" + value;
                        }

                        cb.setValue(value);
                    }
                }
            }
        });
        return ctl; 
    }
});