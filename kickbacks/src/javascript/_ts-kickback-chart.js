Ext.define('Rally.technicalservices.KickbackChart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.tskickbackchart',

    itemId: 'rally-chart',
    chartData: {},
    loadMask: false,
    chartConfig: {
        chart: {
            type: 'column'
        },
        title: {
            text: 'Kickback Chart'
        },
        xAxis: {
            tickInterval: 1,
            title: {
                text: 'Month'
            }
        },
        yAxis: [
            {
                title: {
                    text: 'Number of Events'
                },
                min: 0
            }
        ],
        plotOptions: {
            series: {
                dataLabels: {
                    format: '{point.y:.1f}'
                },
                marker: {
                    enabled: false
                }
            }
        }
    },
    constructor: function (config) {
        this.callParent(arguments);
        if (config.title){
            this.chartConfig.title = config.title;
        }
    }
});
