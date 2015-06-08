Ext.define('Rally.technicalservices.Toolbox',{
    singleton: true,
    /**
     * Returns beginnig of month as date for the current time zone
     * 
     */
    calculatePercentileValue: function(percentileThreshold, arrayValues){

        if (arrayValues && arrayValues.length > 0){

            arrayValues.sort(function(a, b){return a-b});

            var rank = percentileThreshold/100 * (arrayValues.length - 1) + 1,
                k = Math.floor(rank),
                d = rank - k,
                pValue = 0;

            console.log('percentile calcs (len, rank, idx, decimal, value', arrayValues.length, rank, k, d, pValue);

            if (k==0 || arrayValues.length == 1){
                pValue = arrayValues[0];
            } else if (k == arrayValues.length){ //this.shouldn't happen if percentile can't be greater than 100
                pValue = arrayValues[arrayValues.length-1];
            } else {
                pValue = arrayValues[k-1] + d *(arrayValues[k] - arrayValues[k-1]);
            }
            console.log('percentile calcs (len, rank, idx, decimal, value', arrayValues.length, rank, k, d, pValue);
            return pValue;
            return Ext.String.format("rank={0}, k={1}, d={2}, pValue={3}, arrayValues = {4}",rank,k,d,pValue,arrayValues);

        //    var pIdx = arrayValues.length * percentileThreshold/ 100 - 1,
        //        roundedIdx = Math.ceil(pIdx),
        //        pValue = 0;
        //
        //    if (roundedIdx == pIdx && roundedIdx != (arrayValues.length-1)){
        //        pValue = (arrayValues[roundedIdx] + arrayValues[roundedIdx + 1])/2
        //    } else {
        //        pValue = arrayValues[roundedIdx];
        //    }
        //    console.log('percentile calcs (len, idx, rounded idx, value, array', arrayValues.length, pIdx, roundedIdx, pValue,arrayValues);
        //    return pValue;
        }
        return null;
    },
    getBeginningOfMonthAsDate: function(dateInMonth){
        var year = dateInMonth.getFullYear();
        var month = dateInMonth.getMonth();
        return new Date(year,month,1,0,0,0,0);
    },
    getEndOfMonthAsDate: function(dateInMonth){
        var year = dateInMonth.getFullYear();
        var month = dateInMonth.getMonth();
        var day = new Date(year, month+1,0).getDate();
        return new Date(year,month,day,0,0,0,0);
    },
    aggregateSnapsByOid: function(snaps){
        //Return a hash of objects (key=ObjectID) with all snapshots for the object
        var snaps_by_oid = {};
        Ext.each(snaps, function(snap){
            var oid = snap.ObjectID || snap.get('ObjectID');
            if (snaps_by_oid[oid] == undefined){
                snaps_by_oid[oid] = [];
            }
            snaps_by_oid[oid].push(snap);
            
        });
        return snaps_by_oid;
    },
    getCaseInsensitiveKey: function(obj, inputStr){
        var new_key = inputStr;
        Ext.Object.each(obj, function(key, val){
            if (new_key.toLowerCase() == key.toLowerCase()){
                new_key = key;  
            }
         });
        return new_key;

    },
    aggregateSnapsByOidForModel: function(snaps){
        //Return a hash of objects (key=ObjectID) with all snapshots for the object
        var snaps_by_oid = {};
        Ext.each(snaps, function(snap){
            var oid = snap.ObjectID || snap.get('ObjectID');
            if (snaps_by_oid[oid] == undefined){
                snaps_by_oid[oid] = [];
            }
            snaps_by_oid[oid].push(snap.getData());
            
        });
        return snaps_by_oid;
    },
    getDateBuckets: function(startDate, endDate, granularity){

        var bucketStartDate = Rally.technicalservices.Toolbox.getBeginningOfMonthAsDate(startDate);
        var bucketEndDate = Rally.technicalservices.Toolbox.getEndOfMonthAsDate(endDate);
       
        var date = bucketStartDate;
        
        var buckets = []; 
        while (date<bucketEndDate && bucketStartDate < bucketEndDate){
            buckets.push(date);
            date = Rally.util.DateTime.add(date,granularity,1);
        }
        return buckets;  
    },
    formatDateBuckets: function(buckets, dateFormat){
            var categories = [];
            Ext.each(buckets, function(bucket){
                categories.push(Rally.util.DateTime.format(bucket,dateFormat));
            });
            categories[categories.length-1] += "*"; 
            return categories; 
    }
});