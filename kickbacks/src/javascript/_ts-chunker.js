Ext.define('Rally.technicalservices.data.Chunker',{
    MAX_CHUNK_SIZE: 25,
    logger: new Rally.technicalservices.Logger(),
    config: {
        fetch: null,
        find: null,
        chunkField: null,
        chunkOids: null
    },
    constructor: function(config){
        this.initConfig(config);
    },
    load: function(){
        var deferred = Ext.create('Deft.Deferred');
        var oids = this.chunkOids;
        var promises = [];

        if (oids.length > this.MAX_CHUNK_SIZE){
            var start_idx = 0;
            console.log('original array',oids);
            while(start_idx < oids.length){
                chunk_values = oids.splice(start_idx, this.MAX_CHUNK_SIZE);
                promises.push(this._fetchRecords(chunk_values));
            }
        } else {
            promises.push(this._fetchRecords(oids));
        }

        if (promises.length == 0){
            deferred.resolve();
        }
        Deft.Promise.all(promises).then({
            scope: this,
            success: function(records) {
                console.log('chunk rcors', records);
                var data = _.flatten(records);
                deferred.resolve(data);
            },
            failure: function(){
                deferred.resolve([]);
            }
        });
        return deferred;
    },
    _fetchRecords: function(object_ids){
        var deferred = Ext.create('Deft.Deferred');

        var find = this.find;
        find[this.chunkField] = {$in: object_ids}

        Ext.create('Rally.data.lookback.SnapshotStore',{
            fetch: this.fetch,
            autoLoad: true,
            find: find,
            removeUnauthorizedSnapshots: true,
            limit: 'Infinity',
            listeners: {
                scope: this,
                load: function(store, records, success){
                    this.logger.log('chunking success', success);
                    deferred.resolve(records);
                }
            }
        });
        return deferred;
    }
});
