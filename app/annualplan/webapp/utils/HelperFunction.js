sap.ui.define(["sap/ui/core/Fragment","sap/ui/model/Filter","sap/ui/model/FilterOperator"],
    function (Fragment,Filter,FilterOperator) {
   "use strict";
   return {

       _openValueHelpDialog: function (oController, fragmentId, fragmentName) {
            let oView = oController.getView();

            if (!oController[fragmentId]) {
                return Fragment.load({
                    id: oView.getId(),
                    name: fragmentName,
                    controller: oController
                }).then(oDialog => {
                    oController[fragmentId] = oDialog;
                    oView.addDependent(oController[fragmentId]);

                    let oBinding = oDialog.getBinding("items");
                    if (oBinding) {
                        oBinding.filter([]);
                    }
                    oDialog.open();
                }).catch(error => {
                    console.warn("Fragment not Loading", error);
                });
            } else {
                let oBinding = oController[fragmentId].getBinding("items");
                if (oBinding) {
                    oBinding.filter([]);
                }

                oController[fragmentId].open();
            }
        },

       _valueHelpSelectedValue : function(oEvent,oController,inputId){
           let inputValue = oController.byId(inputId)
           let sSelect = oEvent.getParameter("selectedItem")
           let sValue = sSelect.getTitle()
          if(sValue){
            inputValue.setValue(sValue)
            return sValue
          }
       },

       _clearInputValues : function(oControl,ids){
           ids.forEach(id=>{
               let inputField = oControl.byId(id)
               if(inputField){
                   inputField.setValue("")
               }
               else{
                   console.warn(`${id} not Found`)
               }
           })  
       },

     _getFilteredEntityDataOnHana: async function (oControl,sEntitySet, sFilterField, sFilterValue) {
    let oModel = oControl.getOwnerComponent().getModel();
    let oBindList = oModel.bindList("/" + sEntitySet);

    let oFilter = new sap.ui.model.Filter({
        path: sFilterField,
        operator: sap.ui.model.FilterOperator.EQ,
        value1: sFilterValue
    });
    oBindList.filter(oFilter);
    try {
        let oContexts = await oBindList.requestContexts(0, Infinity);
        let oData = oContexts.map(context => context.getObject());

        if (oData.length === 0) {
            console.log(`No data found for ${sFilterField}: ${sFilterValue}`);
            return [];
        }
        return oData;
    } catch (error) {
        console.error(`Error fetching data for ${sEntitySet}`, error);
        return [];
    }
},
        
    _getAllDataOfSingleParam : async function(oController,url,property,param){
       let oModel = oController.getOwnerComponent().getModel()
       let oBindList = oModel.bindList(`/${url}(${property}='${param}')`)
       try {
        let oContext = await oBindList.requestContexts(0,Infinity)
        let oData = oContext.map(context=>context.getObject())
        if(oData.length===0){
            // sap.m.MessageToast.show("Data Not Found")
            return
        }
        return oData
       } catch (error) {
        console.log(`Error occurred while reading data from the '${url}' entity : `, error)
        sap.m.MessageToast.show(error)
       }
    },

     performTableSearchMethod: function (oController,oEvent, tableId, filterFields) {
        const sValue = oEvent.getParameter("query") || oEvent.getParameter("newValue");
        const oTable = oController.getView().byId(tableId);
        if (!oTable) {
            console.error("Table not found");
            return;
        }
        const aFilters = filterFields.map((field) =>
            new sap.ui.model.Filter(field, sap.ui.model.FilterOperator.Contains, sValue)
        );
        const oFilter = new sap.ui.model.Filter({
            filters: aFilters,
            and: false
        });
        const oBinding = oTable.getBinding("items");
        if (!oBinding) {
            console.error("Table binding not found");
            return;
        }
        oBinding.filter(oFilter);
    },


    _getSingleEntityDataWithParam : async function(oControl,url,property,param){
       let oModel = oControl.getOwnerComponent().getModel()
       let oBindList = oModel.bindList(`/${url}(${property}='${param}')`)
       try {
        let oContext = await oBindList.requestContexts(0,Infinity)
        let oData = oContext.map(context=>context.getObject())
        if(oData.length===0){
            // return sap.m.MessageToast.show("Data Not Found")
            return console.log("Data Not Found")
        }
        return oData;
       } catch (error) {
        console.log(`Error occurred while reading data from the '${url}' entity : `, error)
       }
    },

         _getSingleEntityData :async function(oControl,url,param){
        let oModel = oControl.getOwnerComponent().getModel()
        // let oBindList = oModel.bindList(`/${url}('${param}')`)
        let oBindContext = oModel.bindContext(`/${url}('${param}')`);
        try {
            let oData = await oBindContext.requestObject();
            if(oData.length === 0){
                return console.log("Data Not Found")
            }
            return oData
        } catch (error) {
            console.log(`Error occurred while reading data from the '${url}' entity : `, error)
        }
    },
    _valueHelpLiveSearch: function (oEvent, filterFields) {
    let sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue") || "";

    let oDialog = oEvent.getSource();
    if (oDialog.getParent() && oDialog.getParent().isA("sap.m.SelectDialog")) {
        oDialog = oDialog.getParent();
    }

    let oBinding = oDialog.getBinding("items");
    if (!oBinding) {
        console.warn("No binding found for items.");
        return;
    }

    if (sValue && filterFields.length > 0) {
        let aFilters = filterFields.map(field =>
            new sap.ui.model.Filter(field, sap.ui.model.FilterOperator.Contains, sValue)
        );

        let oCombinedFilter = new sap.ui.model.Filter({
            filters: aFilters,
            and: false 
        });

        oBinding.filter([oCombinedFilter], "Application");
    } else {
        oBinding.filter([], "Application");
    }
},

       valueHelpLiveSearch: function (oEvent, filterFields) {
        let sValue =
            oEvent.getParameter("value") ||
            oEvent.getParameter("query") ||
            oEvent.getParameter("newValue");
        let oSource = oEvent.getSource();
        let oBinding = oSource.getBinding("items");
    
        if (!oBinding) {
            console.warn("No binding found for items.");
            return;
        }    
        if (sValue && filterFields.length > 0) {
            let aFilters = filterFields.map(field => 
                new sap.ui.model.Filter(field, sap.ui.model.FilterOperator.Contains, sValue)
            );    
            let oCombinedFilter = new sap.ui.model.Filter({
                filters: aFilters,
                and: false 
            });
            oBinding.filter([oCombinedFilter]);
        } else {
            oBinding.filter([]);
        }
    },   

       getOCDataWithBatchId: async function (oControl,urlPath,batchId) {
           let oModel = oControl.getOwnerComponent().getModel();
           let batchValue = encodeURIComponent(batchId)
           let path = `/${urlPath}(BatchID='${batchValue}')`;
           let oBindList = oModel.bindList(path)        
           try {
               let oContexts = await oBindList.requestContexts(0, Infinity);
               let oData = oContexts.map(context => context.getObject());
               return oData;
           } catch (error) {
               console.error(`Error fetching data from ${url} with BatchID=${batchId}:`, error);
           }
       },
       
       getOCData: async function (oControl, urlPath, queryParam) {
        let oModel = oControl.getOwnerComponent().getModel();
    
        const [paramKey, paramValue] = Object.entries(queryParam)[0];
        const encodedValue = encodeURIComponent(paramValue);
    
        let path = `/${urlPath}(${paramKey}='${encodedValue}')`;
        let oBindList = oModel.bindList(path);
    
        try {
            let oContexts = await oBindList.requestContexts(0, Infinity);
            let oData = oContexts.map(context => context.getObject());
            return oData;
        } catch (error) {
            console.error(`Error fetching data from ${urlPath} with ${paramKey}=${paramValue}:`, error);
        }
    },

   getAllTypeInputValues: function(oController, aControlIds) {
        if (!Array.isArray(aControlIds) || aControlIds.length === 0) {
            console.warn("Invalid control IDs provided");
            return [];
        }
        return aControlIds.map(id => {
            let oControl = oController.byId(id);
            if (!oControl) {
                console.warn(`Control with ID ${id} not found`);
                return null;
            }
    
            let value = null;
    
            if (oControl.isA("sap.m.Input")) {
                value = oControl.getValue();
            }
            else if (oControl.isA("sap.m.ComboBox") || oControl.isA("sap.m.Select")) {
                value = oControl.getSelectedKey() || oControl.getSelectedItem()?.getText();
            }
            else if (oControl.isA("sap.m.DatePicker")) {
                let date = oControl.getDateValue();
                value = date ? date.toISOString().split("T")[0] : null;
            }
            else if (oControl.isA("sap.m.DateTimePicker")) {
                let dateTime = oControl.getDateValue();
                value = dateTime ? dateTime.toISOString() : null; 
            }
            else {
                console.warn(`Unsupported control type for ID: ${id}`);
            }
            return value;
        });
    }
 
    
   };
});
