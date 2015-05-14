Ext.define('Rally.technicalservices.FileUtilities', {
    singleton: true,
    logger: new Rally.technicalservices.Logger(),
    saveHTMLToFile:function(html,file_name,type_object){
        if (type_object == undefined){
            type_object = {type:'text/html;charset=utf-8'};
        }
        var blob = new Blob([html],type_object);
        saveAs(blob,file_name);
    },
    saveAs:function(text,file_name,type_object){
        if (type_object == undefined){
            type_object = {type:'text/plain'};
        }
        var blob = new Blob([text],type_object);
        saveAs(blob,file_name);
    },
    saveTextAsFile: function(textToWrite, fileName)
    {
        var textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
        var fileNameToSaveAs = fileName;

        if (this.detectIE() >= 10){
            console.log(window.navigator);
            window.navigator.msSaveBlob(textFileAsBlob, fileNameToSaveAs);
        } else {

            var downloadLink = document.createElement("a");
            downloadLink.download = fileNameToSaveAs;
            downloadLink.innerHTML = "Download File";
            if (window.webkitURL != null)
            {
                // Chrome allows the link to be clicked
                // without actually adding it to the DOM.
                downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
            }
            else
            {
                // Firefox requires the link to be added to the DOM
                // before it can be clicked.
                downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
                downloadLink.onclick = this.destroyClickedElement;
                downloadLink.style.display = "none";
                document.body.appendChild(downloadLink);
            }
            downloadLink.click();
        }
    },
    destroyClickedElement: function(event)
    {
        document.body.removeChild(event.target);
    },
    convertDataArrayToCSVText: function(data_array, requestedFieldHash){

        var text = '';
        Ext.each(Object.keys(requestedFieldHash), function(key){
            text += requestedFieldHash[key] + ',';
        });
        text = text.replace(/,$/,'\n');

        Ext.each(data_array, function(d){
            Ext.each(Object.keys(requestedFieldHash), function(key){
                if (d[key]){
                    if (typeof d[key] === 'object'){
                        if (d[key].FormattedID) {
                            text += Ext.String.format("\"{0}\",",d[key].FormattedID );
                        } else if (d[key].Name) {
                            text += Ext.String.format("\"{0}\",",d[key].Name );
                        } else if (!isNaN(Date.parse(d[key]))){
                            text += Ext.String.format("\"{0}\",",Rally.util.DateTime.formatWithDefaultDateTime(d[key]));
                        }else {
                            text += Ext.String.format("\"{0}\",",d[key].toString());
                        }
                    } else {
                        text += Ext.String.format("\"{0}\",",d[key] );
                    }
                } else {
                    text += ',';
                }
            },this);
            text = text.replace(/,$/,'\n');
        },this);
        return text;
    },
    scrubStringForXML: function(string){
        console.log('scrub',string);
        if (string) {
            var scrubbed_string = string.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
            return scrubbed_string;
        }
        return '';
    },
    detectIE: function(){
        var ua = window.navigator.userAgent;

        var msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('Trident/');
        if (trident > 0) {
            // IE 11 => return version number
            var rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
            // IE 12 => return version number
            return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }

        // other browser
        return false;
    },
    //https://msdn.microsoft.com/en-us/library/ie/hh673542(v=vs.85).aspx
    getCSVFromGrid:function(grid){
        var store = grid.getStore();

        var columns = grid.columns;
        var column_names = [];
        var headers = [];

        var csv = [];

        Ext.Array.each(columns,function(column){
            if ( column.dataIndex || column.renderer ) {
                column_names.push(column.dataIndex);
                if ( column.csvText ) {
                    headers.push(column.csvText);
                } else {
                    headers.push(column.text);
                }
            }
        });

        csv.push('"' + headers.join('","') + '"');

        var mock_meta_data = {
            align: "right",
            classes: [],
            cellIndex: 9,
            column: null,
            columnIndex: 9,
            innerCls: undefined,
            recordIndex: 5,
            rowIndex: 5,
            style: "",
            tdAttr: "",
            tdCls: "x-grid-cell x-grid-td x-grid-cell-headerId-gridcolumn-1029 x-grid-cell-last x-unselectable",
            unselectableAttr: "unselectable='on'"
        };

        _.each(store.getData().items,function(record){
            var node_values = [];
            Ext.Array.each(columns,function(column){
                if ( column.dataIndex) {
                    var column_name = column.dataIndex;
                    var display_value = record.get(column_name);

                    if ( !column._csvIgnoreRender && column.renderer ) {
                        display_value = column.renderer(display_value,mock_meta_data,record, 0, 0, store, grid.getView());
                    }
                    node_values.push(display_value);
                } else {
                    var display_value = null;
                    if ( !column._csvIgnoreRender && column.renderer ) {
                        display_value = column.renderer(display_value,mock_meta_data,record,record, 0, 0, store, grid.getView());
                        node_values.push(display_value);
                    }
                }
            },this);
            csv.push('"' + node_values.join('","') + '"');
        });
        return csv.join('\r\n');
    }
});

