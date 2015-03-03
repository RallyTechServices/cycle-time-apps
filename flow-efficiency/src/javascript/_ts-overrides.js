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
Ext.override(Rally.domain.WsapiField,{
getAllowedValueStore: function() {
    var allowedValues = this._getAllowedValues();
    if (allowedValues) {
        if(!this._allowedValueStore) {
            this._allowedValueStore = Ext.create('Rally.data.wsapi.collection.Store', {
                fetch: true,
                model: Ext.identityFn('AllowedAttributeValue'),
                proxy: Rally.data.WsapiModelFactory.buildProxy(this.getAllowedValuesRef(), this.name),
                initialCount: allowedValues.length || allowedValues.Count,
                cacheResults: true
            });
        }
        return this._allowedValueStore;
    }
    return null;
}
});

