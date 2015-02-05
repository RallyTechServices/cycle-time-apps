#Filtered Cycle Time

This app shows cycle time for the selected field and start and end values.  
Eligible fields for cycle time calculations are state fields or any fields with drop down values.  

Selected Start value must be before the selected End value (in order).  Order is determined by the drop down
list order in the field definition.  

The data included is from the currently scoped project.  No data from child projects is used.  

Data includes defects and hierarchical requirements that have no children.  

If an artifact was moved from one project to another before completing the cycle, the data will not be captured for that artifact or 
the start date may be the first date that the data was in a state >= start state or >= end state within the scope of the app. 

Cycle time is measured in days from the first date the artifact state goes into a state >= the selected start state to the 
last date the artifact state moves into a state >= the selected end state from a state < the selected end state.  

If no start state is selected, the cycle time will start from the first snapshot or from the first date that the artifact was moved 
into the selected project.  

Filtering Data:
The stories that are considered within the cycle time calculations may be filtered by any dropdown 
fields or by a range for PlanEstimate. 
All filters will be ANDed together

?? Filters will be applied to the data at the time of the snapshot?  



