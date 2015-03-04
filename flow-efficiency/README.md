#Flow Efficiency

This flow efficiency App measures the efficiency of start-state to end-state progression.  
Eligible fields for flow efficiency calculations are state fields or any fields with drop down values.  

![ScreenShot](/images/flow-efficiency.png) 

The flow efficiency is defined as (cycletime - blocked time - ready time) * 100.
The blocked time and ready time used in the calculations are only times during the duration of the cycle time.    
For example:  If an item is blocked past the end state transition, the blocked time will only include the time up until the end state is changed.  

Note that the Ready flag is not on the Defect, so only blocked time is subtracted for defect calculations. 

Blocked time and Ready time are calculated in increments of seconds and a percentage of the cycle time in seconds.  

Note, however, that total cycle time is rounded up to the next day after the flow efficiency is calculated.  This information is intended to be
consistent with the filtered cycle time app and is displayed in the grid below the flow efficiency chart.  

Selected Start value must be before the selected End value (in order).  Order is determined by the drop down
list order in the field definition.  

The data included is from the currently scoped project context.  

Data includes defects and hierarchical requirements that have no children.  

If an artifact was moved from one project to another before completing the cycle, the data will not be captured for that artifact or 
the start date may be the first date that the data was in a state >= start state or >= end state within the scope of the app. 

Data Filters:
*  The stories that are considered within the cycle time calculations may be filtered by any dropdown 
fields or by a range for PlanEstimate. 
*  All filters will be ANDed together
*  The filter criteria is tested on at the time when the data transitions into the end state. 

Trendlines
Trendlines are calculated using the regression equation Y = a + bX where (a) is the intercept and (b) is the slope as calculated by the following:

 * Slope(b) = (N * ΣXY - (ΣX)(ΣY)) / (N * ΣX2 - (ΣX)2) 
 * Intercept(a) = (ΣY - b(ΣX)) / N

Where N is the number of data points used in the calculation.  If a data point is null, it is not included in the calculation or N (number of points).  The 
Y data point is the mean of the cycle time for the date bucket represented by the X ordinal.  

#####Caveats (PLEASE READ):
In order to help tune performance, the ScheduleState field is being manually hydrated after the snapshots are returned from the database.  Because these values
are difficult to retrieve from the API, the ScheduleState ObjectIDs have been hardcoded into this app.  If this app is used in a different workspace or subscription,
then ScheduleState calculations may not work.  Also, if a new schedule state is added or an existing schedule state name is changed, those values will need to be 
updated in the scheduleStateMapping hash of the App.js file.  

