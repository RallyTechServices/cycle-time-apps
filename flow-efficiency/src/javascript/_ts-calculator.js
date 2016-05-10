Ext.define('CycleCalculator', {
//    extend: "Rally.data.lookback.calculator.BaseCalculator",
    logger: new Rally.technicalservices.Logger(),
    config: {
        cycleField: 'ScheduleState',
        cycleStartValue: 'Defined',
        cycleEndValue: 'Accepted',
        cyclePrecedence: [],
        startDate: null,
        endDate: null,
        granularity: "month",
        dateFormat: "M yyyy",
        dataFilters: [],
        color: {
            Defect:'red',
            HierarchicalRequirement: 'green',
            Combined: 'blue'
        }
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

         series.push(this._getSeries(cycle_time_data, date_buckets, this.granularity,undefined,'black'));  
         var hr_series = this._getSeries(cycle_time_data, date_buckets, this.granularity,'HierarchicalRequirement','');
         series.push(hr_series);  
         
         var defect_series = this._getSeries(cycle_time_data, date_buckets, this.granularity,'Defect',this.color.Defect);
         series.push(defect_series);  
         
         series.push(this._getTrendline(hr_series));
         series.push(this._getTrendline(defect_series));

         categories = Rally.technicalservices.Toolbox.formatDateBuckets(date_buckets,this.dateFormat);
         
         var cycleTimeDataExport = [];
         Ext.each(cycle_time_data, function(ctd){
             ctd.startDate = Rally.util.DateTime.fromIsoString(ctd.startDate);
             ctd.endDate = Rally.util.DateTime.fromIsoString(ctd.endDate);
             cycleTimeDataExport.push(ctd);
         });
         this.cycleTimeDataExport = cycleTimeDataExport; 
         
         this.summaryData = this._getSummary(cycle_time_data, date_buckets, this.granularity, categories);
         
         return {
            series: series,
            categories: categories
        }
    },
    _getTrendline: function(series, color){
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
             color: color,
             data: y,
             display: 'line',
             dashStyle: 'Dash'
         };

    },
    _getCycleTimeData: function(snaps, field, startValue, endValue, precedence){
        var start_index = -1;  
        if (startValue != null){  //This is in case there is no start value (which means grab the first snapshot)
            var start_index = _.indexOf(precedence, startValue);
        }
        var end_index = _.indexOf(precedence, endValue);

        
        //Assumes snaps are stored in ascending date order.  
        var start_date = null, end_date = null, between_states = false, days = null; 
        var type = snaps[0]._TypeHierarchy.slice(-1)[0];
        
        var previous_state_index = -1;
        var state_index = -1;
        var blocked_time = 0, unblocked_date = null, blocked_date = null;  
        var ready_time = 0, unready_date = null, ready_date = null; 
        var seconds = null;
        var days = null;
        var should_include = false; 

        Ext.each(snaps, function(snap){
            
            if (snap[field]){
                previous_state_index = state_index;
                state_index = _.indexOf(precedence, snap[field]);
            }
            if (state_index >= start_index && previous_state_index < start_index){
                start_date = Rally.util.DateTime.fromIsoString(snap._ValidFrom);  
            }

            if (state_index >= end_index && previous_state_index < end_index){
                end_date = Rally.util.DateTime.fromIsoString(snap._ValidFrom);
                if (start_date != null){
                    seconds = Rally.util.DateTime.getDifference(end_date,start_date,"second");
                    days = Math.floor(seconds/86400) + 1;  
                }
                should_include = this._snapMeetsFilterCriteria(snap);
            }
        }, this);
        
        var blocked_time = this._getTimeInBooleanState(snaps, 'Blocked', start_date, end_date);
        var ready_time = this._getTimeInBooleanState(snaps, 'Ready',start_date, end_date);
        
        var pct_blocked = 0, pct_ready=0;
        if (seconds > 0) {
            pct_blocked = (blocked_time/seconds * 100);
            pct_ready = (ready_time/seconds * 100);
        }
        

        
        return {formattedId: snaps[0].FormattedID, 
                seconds: seconds, 
                days: days, 
                endDate: end_date, 
                startDate: start_date, 
                artifactType: type, 
                'include': should_include,
                blockedTime: blocked_time,
                readyTime: ready_time,
                pctBlocked: pct_blocked,
                pctReady: pct_ready};
    },
    _getTimeInBooleanState: function(snaps, stateField, startDate, endDate){
        var current, previous = null; 
        var true_date = null, false_date = null; 
        var true_time = 0;
        
        
        Ext.each(snaps, function(snap){
            previous = current;  
            current = snap[stateField];
            
            var valid_to = Rally.util.DateTime.fromIsoString(snap._ValidTo);
            var valid_from = Rally.util.DateTime.fromIsoString(snap._ValidFrom);

            if (valid_to >= startDate && valid_from <= endDate){
                if (current != previous){
                    if (current === true){
                        true_date = valid_from; 
                        if (valid_from < startDate){
                            true_date = startDate;
                        }
                    } else {
                        if (current === false && previous === true){
                            false_date = valid_from;
                            if (true_date && false_date){
                                true_time += Rally.util.DateTime.getDifference(false_date,true_date,"second");
                                true_date = null;
                                false_date = null;  
                            }
                        }
                    }
                }
            }
        },this);
        
        if (true_date != null && false_date == null){
            true_time += Rally.util.DateTime.getDifference(endDate,true_date,"second");
        }
        return true_time; 

    },
    _snapMeetsFilterCriteria: function(snap){
        var is_filtered = true;
       // this.logger.log('_snapMeetsFilterCriteria', snap, filter);
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
                //this.logger.log('_snapMeetsFilterCriteria filter property or value is blank', filter.property, snap[filter.property], is_filtered);
            } else {
                var str_eval = Ext.String.format(str_format, snap[filter.property], operator, val);
                is_filtered = eval(str_eval);
                //this.logger.log('_snapMeetsFilterCriteria eval', filter, str_eval,is_filtered);
            }
            return is_filtered;  //if filtered is false, then we want to stop looping.  
        },this);
        
        return is_filtered;  
    },
    _getSeries: function(cycle_time_data, date_buckets, granularity, type, color){
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
                    //var efficiency = 100;
                    if (cdata.seconds > 0){
                        var adjusted_cycle_time = (cdata.seconds - cdata.blockedTime - cdata.readyTime);  
                        var efficiency = (adjusted_cycle_time/cdata.seconds) * 100;
                        series_raw_data[i].push(efficiency);
                    }
                    //series_raw_data[i].push(efficiency);
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
             color: color,
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
    },
    _getSummary: function(cycle_time_data, date_buckets, granularity, categories){

        var cycle_time = [];
        var blockers = [];
        var ready = [];
        var cycle_time_in_days = [];  
        
        for (var i=0; i<date_buckets.length; i++){
            cycle_time[i] = [];
            blockers[i] = [];
            ready[i] = [];
            cycle_time_in_days[i] = [];
        }
        
        Ext.each(cycle_time_data, function(cdata){
            for (var i=0; i<date_buckets.length; i++){
                if (cdata.endDate >= date_buckets[i] && cdata.endDate < Rally.util.DateTime.add(date_buckets[i],granularity,1)){
                    if (cdata.seconds > 0){
                        cycle_time[i].push(cdata.seconds || 0);
                        blockers[i].push(cdata.pctBlocked || 0);
                        ready[i].push(cdata.pctReady || 0);
                        cycle_time_in_days[i].push(cdata.days);
                    }
                }
            }
        });

        summaryData = [];
        for (var i=0; i<date_buckets.length; i++){
            var cycle_time_avg = 0, 
                 pct_blocked = 0, 
                 pct_ready = 0,
                 num_artifacts = 0,  
                total_cycle_time = 0;
            if (cycle_time[i].length > 0){
                cycle_time_avg = (Ext.Array.mean(cycle_time[i])/86400).toFixed(); //convert to days
                num_artifacts = cycle_time[i].length;  
                total_cycle_time = Ext.Array.sum(cycle_time[i]);
                if (Ext.Array.sum(cycle_time[i]) > 0){
                    pct_blocked = Ext.Array.mean(blockers[i]) ;
                    pct_blocked = pct_blocked.toFixed(1);
                    pct_ready = Ext.Array.mean(ready[i]);
                    pct_ready = pct_ready.toFixed(1);
                }
            } 
          //  total_cycle_time = (total_cycle_time/86400).toFixed(1); 
            summaryData.push({date: categories[i], avgCycleTime: cycle_time_avg, pctBlocked: pct_blocked, pctReady: pct_ready, numArtifacts: num_artifacts, totalCycleTime: Ext.Array.sum(cycle_time_in_days[i])})
        }

        return summaryData;
    },
});