Ext.define('CycleCalculator', {
//    extend: "Rally.data.lookback.calculator.BaseCalculator",
    logger: new Rally.technicalservices.Logger(),
    config: {
        cycleField: 'ScheduleState',
        cycleStartValue: 'Defined',
        cycleEndValue: 'Accepted',
        cyclePrecedence: [],
        cycleNames: {}, 
        startDate: null,
        endDate: null,
        granularity: "month",
        dateFormat: "M yyyy",
        dataFilters: [],
        modelNames: [],
        color: {
            Defect:'red',
            HierarchicalRequirement: 'green',
            Combined: 'blue',
            PortfolioItem: 'blue'
        },
        excludeWeekends:false
    },
    cycleTimeData: null,
    snapsByOid: {},
    constructor: function (config) {
        this.mergeConfig(config);
    },
    runCalculation: function(snapshots) {
        var snaps_by_oid = Rally.technicalservices.Toolbox.aggregateSnapsByOid(snapshots);
         var date_buckets = Rally.technicalservices.Toolbox.getDateBuckets(this.startDate, this.endDate, this.granularity);

         var cycle_time_data = [];
         
         Ext.Object.each(snaps_by_oid, function(oid, snaps){
             var ctd = this._getCycleTimeData(snaps, this.cycleField, this.cycleStartValue, this.cycleEndValue, this.cyclePrecedence);
             if (ctd.include){
                cycle_time_data.push(ctd);
             }
         },this);
         
         
         var series = [];

         if ( this.modelNames.length > 1 ) {
            series.push(this._getSeries(cycle_time_data, date_buckets, this.granularity,undefined));
         }
         
         Ext.Array.each(this.modelNames, function(type) {
            series.push(this._getSeries(cycle_time_data, date_buckets, this.granularity,type));
         },this);
         
         Ext.Array.each(this.modelNames,function(type){
            series.push(this._getTrendline(this._getSeries(cycle_time_data, date_buckets, this.granularity,type)));
         },this);

        Ext.Array.each(this.modelNames,function(type){
            series.push(this._getPercentileLine(cycle_time_data, date_buckets, this.granularity,type));
        },this);

         categories = Rally.technicalservices.Toolbox.formatDateBuckets(date_buckets,this.dateFormat);
         
         var cycleTimeDataExport = [];
         Ext.each(cycle_time_data, function(ctd){
             ctd.startDate = Rally.util.DateTime.fromIsoString(ctd.startDate);
             ctd.endDate = Rally.util.DateTime.fromIsoString(ctd.endDate);
             if (ctd.endDate > date_buckets[0]){ //Only export data that is within the requested time frame
                 cycleTimeDataExport.push(ctd);
             }
         });
         this.cycleTimeDataExport = cycleTimeDataExport; 

         
         return {
            series: series,
            categories: categories
        }
    },
    _getPercentileLine: function(cycletimedata, date_buckets, granularity, type){
        var series_raw_data = [];
        var series_data = [];
        var tooltip_data = [];

        for (var i=0; i<date_buckets.length; i++){
            series_raw_data[i] = [];
            tooltip_data[i] = 0;
            series_data[i] = {y: null, n: 0};
        }

        Ext.each(cycletimedata, function(cdata){
            for (var i=0; i<date_buckets.length; i++){
                if ((type == undefined || type == cdata.artifactType) && cdata.endDate >= date_buckets[i] && cdata.endDate < Rally.util.DateTime.add(date_buckets[i],granularity,1)){
                    series_raw_data[i].push(cdata.days)
                }
            }
        });

        var series_data = _.range(date_buckets.length).map(function () { return {y: null, n: 0} })
        for (var i=0; i<series_raw_data.length; i++){
            var pValue = Rally.technicalservices.Toolbox.calculatePercentileValue(this.percentileLineThreshold, series_raw_data[i]);
            this.logger.log('Calculate Percentile (len, value)',type, series_raw_data[i].length, pValue);
            if (pValue){
                series_data[i].y = pValue;
                series_data[i].n = '(' + series_raw_data[i].length + ' Artifacts)';
            }
        }

        return {
            name: Ext.String.format("{0}% for {1}", this.percentileLineThreshold, this._getSeriesName(type)),
            color: this._getColorForSeries(type),
            data: series_data,
            display: 'line',
            dashStyle: 'Dot'
        };
    },
    _getTrendline: function(series){
        /**
         * Regression Equation(y) = a + bx  
         * Slope(b) = (NΣXY - (ΣX)(ΣY)) / (NΣX2 - (ΣX)2) 
         * Intercept(a) = (ΣY - b(ΣX)) / N
         */

        var sum_xy = 0;
        var sum_x = 0;
        var sum_y = 0;
        var sum_x_squared = 0;
        var n = 0;  
        for (var i=0; i<series.data.length; i++){
            if (series.data[i].y){
                sum_xy += series.data[i].y * i;
                sum_x += i;
                sum_y += series.data[i].y;
                sum_x_squared += i * i;
                n++;
            }
        }
        var slope = (n*sum_xy - sum_x * sum_y)/(n*sum_x_squared - sum_x * sum_x);
        var intercept = (sum_y - slope * sum_x)/n;  

        this.logger.log('trendline data (name, slope, intercept)',series.name, slope, intercept);
        
        var y = [];
        if (!isNaN(slope) && !isNaN(intercept)){
            y = _.range(series.data.length).map(function () {return null})
            for (var i =0; i<series.data.length; i++){
               y[i] = intercept + slope * i;  
            }
        }
        this.logger.log('_getTrendline', y);
        return {
             name: series.name + ' Trendline',
             color: series.color,
             data: y,
             display: 'line',
             dashStyle: 'LongDash'
         };

    },
    _getCycleTimeData: function(snaps, field, startValue, endValue, precedence){
        var start_index = -1;  
        if (! Ext.isEmpty(startValue)){  //This is in case there is no start value (which means grab the first snapshot)
            var start_index = _.indexOf(precedence, startValue);
        }
        var end_index = _.indexOf(precedence, endValue);

        var include = false; 
        
        //Assumes snaps are stored in ascending date order.  
        var start_date = null, end_date = null, between_states = false, days = null; 
        var type = snaps[0]._TypeHierarchy.slice(-1)[0];
        
        var previous_state_index = -1;
        var state_index = -1;
        var seconds = null;
        var days = null;
        var include = false; 

        if ( start_index == -1 ) {
            start_date = Rally.util.DateTime.fromIsoString(snaps[0]._ValidFrom);
        }
        
        Ext.each(snaps, function(snap){            
            if (snap[field]){
                previous_state_index = state_index;
                state_index = _.indexOf(precedence, snap[field]);
            } else {
                if (previous_state_index > 0){
                    //the field was cleared out
                    state_index = -1;
                }
            }
            if (state_index >= start_index && previous_state_index < start_index && start_index > -1){
                start_date = Rally.util.DateTime.fromIsoString(snap._ValidFrom);  
            }
            if (state_index >= end_index && previous_state_index < end_index){
                end_date = Rally.util.DateTime.fromIsoString(snap._ValidFrom);

                console.log('fred',start_date, end_date, snap.FormattedID, include, days);

                if (start_date != null){
                    seconds = Rally.util.DateTime.getDifference(end_date,start_date,"second");
                    if(this.excludeWeekends){
                        days = Math.floor(seconds/86400) + 1;  
                    }else{
                        days = Rally.technicalservices.util.Utilities.daysBetween(start_date,end_date,this.excludeWeekends);
                    }
                }
                include = this._snapMeetsFilterCriteria(snap);
            }
            console.log('start',start_date, end_date, snap.FormattedID, include, days);

        }, this);
        
        return {formattedId: snaps[0].FormattedID, seconds: seconds, days: days, endDate: end_date, startDate: start_date, artifactType: type, include: include };
    },
    _snapMeetsFilterCriteria: function(snap){
        var is_filtered = true;
        this.logger.log('_snapMeetsFilterCriteria', snap);
        Ext.each(this.dataFilters, function(filter){
            var str_format = "{0} {1} {2}";
            if (isNaN(snap[filter.property]) && isNaN(filter.value)){
                str_format = "\"{0}\" {1} \"{2}\"";
            }
            var operator = filter.operator;
            if (operator == "="){
                operator = "==";
            }
            
            var val = filter.value || '';
            if (val.length == 0 || snap[filter.property].length == 0){
                is_filtered = (val.length == 0 && snap[filter.property].length == 0);  
                this.logger.log('_snapMeetsFilterCriteria filter property or value is blank', filter.property, snap[filter.property], is_filtered);
            } else {
                var str_eval = Ext.String.format(str_format, snap[filter.property], operator, val);
                is_filtered = eval(str_eval);
                this.logger.log('_snapMeetsFilterCriteria eval', filter, str_eval,is_filtered);
            }
            return is_filtered;  //if filtered is false, then we want to stop looping.  
        },this);
        
        return is_filtered;  
    },
    
    _getColorForSeries: function(type) {
        var color = 'black';
        if ( this.color[type]) {
            color = this.color[type];
        }
        if (  /PortfolioItem/.test(type) ) {
            color = this.color.PortfolioItem;
        }

        return color;
    },
    _getSeries: function(cycle_time_data, date_buckets, granularity, type){
        var series_raw_data = [];
        var series_data = [];
        var tooltip_data = [];
        for (var i=0; i<date_buckets.length; i++){
            series_raw_data[i] = [];
            tooltip_data[i] = 0;
            series_data[i] = {y: null, n: 0};
        }
        
        Ext.each(cycle_time_data, function(cdata){
            for (var i=0; i<date_buckets.length; i++){
                if ((type == undefined || type == cdata.artifactType) && cdata.endDate >= date_buckets[i] && cdata.endDate < Rally.util.DateTime.add(date_buckets[i],granularity,1)){
                    series_raw_data[i].push(cdata.days)
                }
            }
        });

        var validDataPoints = 0;
        var series_data = _.range(date_buckets.length).map(function () { return {y: null, n: 0} })
        for (var i=0; i<series_raw_data.length; i++){
            if (series_raw_data[i].length > 0){
                series_data[i].y = Ext.Array.mean(series_raw_data[i]);
                series_data[i].n = '(' + series_raw_data[i].length + ' Artifacts)';
            } 
        }

        return {
             name: this._getSeriesName(type),
             color: this._getColorForSeries(type),
             data: series_data
         };
    },
    _getSeriesName: function(type){
        var type_text = "Combined";
        if (type) {
            type_text = type;
            if (type == 'HierarchicalRequirement'){
                type_text = "User Story";
            }
        }
        return Ext.String.format(type_text);
    }
});