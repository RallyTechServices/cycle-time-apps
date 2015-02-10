#Filtered Cycle Time

This app shows cycle time for the selected field and start and end values.  
Eligible fields for cycle time calculations are state fields or any fields with drop down values.  

![ScreenShot](/images/filtered-cycle-time.png) 

Selected Start value must be before the selected End value (in order).  Order is determined by the drop down
list order in the field definition.  

The data included is from the currently scoped project context.  

Data includes defects and hierarchical requirements that have no children.  

If an artifact was moved from one project to another before completing the cycle, the data will not be captured for that artifact or 
the start date may be the first date that the data was in a state >= start state or >= end state within the scope of the app. 

Cycle time is measured in days from the first date the artifact state goes into a state >= the selected start state to the 
last date the artifact state moves into a state >= the selected end state from a state < the selected end state.  

If no start state is selected, the cycle time will start from the first snapshot or from the first date that the artifact was moved 
into the selected project.  

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
