#Kickbacks and Deletions

Displays artifacts that have been deleted or moved into a previous state.

![ScreenShot](/images/kickbacks.png)

#### Kickbacks
The graph shows the number of kickbacks within each month.  If a single artifact has multiple kickbacks
within the month, each kickback will be represented on the graph.

A Kickback Threshold (in seconds) can be set via the App Settings.  If a story is moved into
a previous state and then back to the original state within the Kickback threshold, it will not
be counted as a kickback.  The default threshold is 300 seconds (5 minutes).

#### Deletions
The app will show items that have been deleted and the date they were deleted.  The app deletions include
artifacts that have been deleted and are in the recycle bin as well as artifacts that have been
permanently deleted.

#### Caveats
Note that if an artifact has been moved into another project, but the user running the app does not have
visibility into that project, it may appear as the artifact has been deleted.

This app uses the Rally App SDK version 2.0 and the Lookback API.