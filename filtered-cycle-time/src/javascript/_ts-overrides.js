Ext.override(Rally.ui.picker.FieldPicker, {
    _shouldShowField: function(field) {
        var allowed_attribute_types = ['STATE','STRING'];
        if (field.attributeDefinition){
            var attr_def = field.attributeDefinition;
            return (attr_def.Constrained && Ext.Array.contains(allowed_attribute_types, attr_def.AttributeType) && attr_def.ReadOnly == false)
        }
        return false;
    }
});