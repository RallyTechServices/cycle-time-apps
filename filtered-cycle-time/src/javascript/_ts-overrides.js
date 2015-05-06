Ext.override(Rally.ui.picker.FieldPicker, {
    _shouldShowField: function(field) {
        var allowed_attribute_types = ['STATE','STRING'];
        if (field.attributeDefinition){
            var attr_def = field.attributeDefinition;
            //console.log(attr_def.ElementName, attr_def.AttributeType, attr_def);
            
            var can_use = false;
            if ( attr_def.ElementName == "State" ) { 
                can_use = true;
            }

            if ( attr_def.Constrained && Ext.Array.contains(allowed_attribute_types, attr_def.AttributeType) && attr_def.ReadOnly == false ) {
                can_use = true;
            }
            
            var forbidden_fields = ['c_ProjectManager','c_ImpactScore'];
            
            if ( Ext.Array.contains(forbidden_fields, attr_def.ElementName) ) {
                 can_use = false;
            }
            
            
            return can_use
        }
        return false;
    }
});

Ext.override(Ext.data.proxy.Server, {
    timeout : 60000,
    processResponse: function(success, operation, request, response, callback, scope) {
        var me = this,
            reader,
            result;

        if (success === true) {
            reader = me.getReader();
            reader.applyDefaults = operation.action === 'read';
            result = reader.read(me.extractResponseData(response));

            if (result.success !== false) {

                Ext.apply(operation, {
                    response: response,
                    resultSet: result
                });

                operation.commitRecords(result.records);
                operation.setCompleted();
                operation.setSuccessful();
            } else {
                operation.setException(result.message);
                me.fireEvent('exception', this, response, operation);
            }
        } else {
            if (response) {
                me.setException(operation, response);
            }
            me.fireEvent('exception', this, response, operation);
        }


        if (typeof callback == 'function') {
            callback.call(scope || me, operation);
        }

        me.afterRequest(request, success);
    },


    setException: function(operation, response) {
        operation.setException({
            status: response.status ,
            statusText: response.statusText
        });
    },


    extractResponseData: Ext.identityFn,


    applyEncoding: function(value) {
        return Ext.encode(value);
    }
});
