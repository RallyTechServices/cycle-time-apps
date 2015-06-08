/**
 * Created by kcorkan on 6/8/15.
 */
describe("Calculate Percentile TestSet", function() {
    it("should recover gracefully from a null arrayValues input",function(){
        expect(
            Rally.technicalservices.Toolbox.calculatePercentileValue(85,null)
        ).toBe(
            null
        );
    });

    it("should recover gracefully from an empty arrayValues input",function(){
        expect(
            Rally.technicalservices.Toolbox.calculatePercentileValue(85,null)
        ).toBe(
            null
        );
    });

    it("should calculate percentile correctly for 1 data point = 0",function(){
        expect(
            Rally.technicalservices.Toolbox.calculatePercentileValue(85,[0])
        ).toBe(
            0
        );
    });

    it("should calculate percentile correctly for 1 data point",function(){
        expect(
            Rally.technicalservices.Toolbox.calculatePercentileValue(85,[16])
        ).toBe(
            16
        );
    });
    it("should calculate percentile correctly for 2 data points",function(){
        expect(
            Number(Rally.technicalservices.Toolbox.calculatePercentileValue(60,[16,23]).toFixed(1))
        ).toBe(
           Number(20.2)
        );
    });
    it("should calculate percentile correctly for 2 data points",function(){
        expect(
            Number(Rally.technicalservices.Toolbox.calculatePercentileValue(90,[16,23]).toFixed(1))
        ).toBe(
            22.3
        );
    });
    it("should calculate percentile correctly for a data set",function(){
        expect(
            Number(Rally.technicalservices.Toolbox.calculatePercentileValue(40,[15, 20, 35, 40, 50]).toFixed(1))
        ).toBe(
            29.0
        );
    });
    it("should calculate percentile correctly for an unsorted dataset",function(){
        expect(
            Number(Rally.technicalservices.Toolbox.calculatePercentileValue(40,[35, 50, 15, 40, 20]).toFixed(1))
        ).toBe(
            29.0
        );
    });
});
