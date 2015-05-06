Ext.define('Rally.technicalservices.KickbackCalculator', {
    logger: new Rally.technicalservices.Logger(),
    config: {
        kickbackField: 'ScheduleState',
        kickbackPrecedence: [],
        startDate: null,
        endDate: null,
        granularity: "month",
        dateFormat: "M yyyy",
    },

    snapsByOid: {},

    constructor: function (config) {
        this.mergeConfig(config);
    },
    runCalculation: function(snapshots){

        var snaps_by_oid = Rally.technicalservices.Toolbox.aggregateSnapsByOidForModel(snapshots);
        var date_buckets = Rally.technicalservices.Toolbox.getDateBuckets(this.startDate, this.endDate, this.granularity);

        var kickBackData = [];

        Ext.Object.each(snaps_by_oid, function(oid, snaps){
            var kbd = this._getKickbackData(snaps, this.kickbackField, this.kickbackPrecedence);
            if (kbd) {
                kickBackData.push(kbd);
            }
        },this);

        var series = this._getSerieses(kickBackData, date_buckets, this.granularity);

        categories = Rally.technicalservices.Toolbox.formatDateBuckets(date_buckets,this.dateFormat);

       //{formattedID: formattedID, name: name, kickbacks: kickbacks, deletedDate: deleteDate, deletedState: deletedState};
       var kickBackDataExport = [];
        Ext.each(kickBackData, function(kbd){
            var formattedID = kbd.formattedID,
                name = kbd.name,
                type = kbd.type || null;

            if (kbd.deletedDate){
                kickBackDataExport.push({formattedID: formattedID, name: name, type: type, lastState: kbd.deletedState, currentState: null, date: kbd.deletedDate, deletion: true});
            }
            _.each(kbd.kickbacks, function(kb){
                kickBackDataExport.push({formattedID: formattedID, name: name, type: type, lastState: kb.lastState, currentState: kb.currentState, date: kb.date, deletion: false});
            });
        });
        this.kickBackDataExport = kickBackDataExport;

        return {
            series: series,
            categories: categories
        }
    },
    _getKickbackData: function(snaps, field, precedence) {

        //Assumes snaps are stored in ascending date order.
        var previous_state_index = -1;
        var state_index = -1;
        var seconds = null;
        var days = null;
        var include = false;
        console.log('--');

        //First check for deletions
        var deletions = [];
        var kickbacks = [];

        var lastSnap = snaps.slice(-1)[0],
            lastValidTo = Rally.util.DateTime.fromIsoString(lastSnap._ValidTo),
            deleteDate = null,
            deletedState = null,
            formattedID = lastSnap.FormattedID,
            name = lastSnap.Name;

        if (lastValidTo < new Date()) {
            deleteDate = lastValidTo;
            deletedState = lastSnap[field];
        }

        Ext.each(snaps, function (snap) {
            if (snap[field]) {
                previous_state_index = state_index;
                state_index = _.indexOf(precedence, snap[field]);
            }

            if (previous_state_index > state_index) {
                var validFrom = Rally.util.DateTime.fromIsoString(snap._ValidFrom);
                kickbacks.push({
                    date: validFrom,
                    lastState: precedence[previous_state_index],
                    currentState: snap[field]
                })
            }
        }, this);

        if (kickbacks.length > 0 || deleteDate) {
            return {
                formattedID: formattedID,
                name: name,
                kickbacks: kickbacks,
                deletedDate: deleteDate,
                deletedState: deletedState
            };
        }
        return null;

    },
    _getSerieses: function(kickbackData, date_buckets, granularity){
        var kickbackCount =[],
            deletedCount = [];

        for (var i=0; i<date_buckets.length; i++){
            kickbackCount[i] = 0;
            deletedCount[i] = 0;
        }

        Ext.each(kickbackData, function(kdata){
            for (var i=0; i<date_buckets.length; i++){
                if (kdata.deletedDate && kdata.deletedDate >= date_buckets[i] && kdata.deletedDate < Rally.util.DateTime.add(date_buckets[i], granularity, 1)){
                    deletedCount[i]++;
                }
                Ext.each(kdata.kickbacks, function(kb) {
                    if (kb.date >= date_buckets[i] && kb.date < Rally.util.DateTime.add(date_buckets[i], granularity, 1)) {
                        kickbackCount[i]++;
                    }
                });
            }
        });

        return [{
            name: 'Kickbacks',
            data: kickbackCount
        },{
            name: 'Deletions',
            data: deletedCount
        }];
    }
});
