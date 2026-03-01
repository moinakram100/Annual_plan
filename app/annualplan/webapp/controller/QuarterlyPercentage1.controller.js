sap.ui.define([
    "sap/ui/core/mvc/Controller",
], (Controller,HelperFunction) => {
    "use strict";

    return Controller.extend("com.ingenx.annualplan.controller.QuarterlyPercentage", {
        onInit() {
            let oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("onRouteQuarterlyPercentage").attachPatternMatched(this._onPatternMatched, this);
             let oData = {
        Header: {
            Material: "",
            MaterialDesc: ""
        },

        MaterialVH: [
            {
                Material: "MAT001",
                MaterialDesc: "Natural Gas",
                Q1_Percentage: 25,
                Q2_Percentage: 25,
                Q3_Percentage: 25,
                Q4_Percentage: 25
            },
            {
                Material: "MAT002",
                MaterialDesc: "LNG",
                Q1_Percentage: 20,
                Q2_Percentage: 30,
                Q3_Percentage: 25,
                Q4_Percentage: 25
            },
            {
                Material: "MAT003",
                MaterialDesc: "Naphtha",
                Q1_Percentage: 30,
                Q2_Percentage: 20,
                Q3_Percentage: 30,
                Q4_Percentage: 20
            }
        ],

        QuarterlyData: [],

        UIState: {
            isEditable: false
        }
    };

    let oModel = new sap.ui.model.json.JSONModel(oData);
    this.getView().setModel(oModel, "quarterlyModel");
},

_onPatternMatched : function(){
      	// var oModel = new JSONModel(sap.ui.require.toUrl("sap/ui/demo/mock/products.json"));
		// 	this.getView().setModel(oModel);

			this.getView().byId("materialMultiInput").setFilterFunction(function(sTerm, oItem) {
				// A case-insensitive 'string contains' filter
				var sItemText = oItem.getText().toLowerCase(),
					sSearchTerm = sTerm.toLowerCase();

				return sItemText.indexOf(sSearchTerm) > -1;
			});
},

        handleSelectionFinish: function (oEvent) {

    let aSelectedKeys = oEvent.getSource().getSelectedKeys();

    let oModel = this.getView().getModel("quarterlyModel");

    let aMaterialVH = oModel.getProperty("/MaterialVH");

    let aTableData = [];

    aSelectedKeys.forEach(function (sKey) {

        let oMaterial = aMaterialVH.find(function (item) {
            return item.Material === sKey;
        });

        if (oMaterial) {
            aTableData.push({
                Material: oMaterial.Material,
                MaterialDesc: oMaterial.MaterialDesc,
                Q1_Percentage: oMaterial.Q1_Percentage,
                Q2_Percentage: oMaterial.Q2_Percentage,
                Q3_Percentage: oMaterial.Q3_Percentage,
                Q4_Percentage: oMaterial.Q4_Percentage,
                Total:
                    (parseFloat(oMaterial.Q1_Percentage) || 0) +
                    (parseFloat(oMaterial.Q2_Percentage) || 0) +
                    (parseFloat(oMaterial.Q3_Percentage) || 0) +
                    (parseFloat(oMaterial.Q4_Percentage) || 0)
            });
        }

    });

    // 🔹 Set Table Data
    oModel.setProperty("/QuarterlyData", aTableData);

    // 🔹 Make Table Editable
    oModel.setProperty("/UIState/isEditable", true);

},

        getMaterialData : function(isSelected){
              try {
                 if(!isSelected){
                    return sap.m.MessageToast("Material Not Found, please select other material");
                 }
                 let oTable = this.byId("idQuarterTable");
                 let oContext = oTable.getBoundContext("quarterlyModel");
                 let oData = oContext.map(item=>item.getObject());

              } catch (error) {
                 let msg = sap.ui.getCore().getModel().getMessageManager()?.getMessage();
                 sap.m.MessageToast(error)
              }
        },

onMaterialValueHelp: function () {

    if (!this._oMaterialVH) {

        sap.ui.core.Fragment.load({
            id: this.getView().getId(),
            name: "com.ingenx.annualplan.fragments.Material",
            controller: this
        }).then(function (oDialog) {

            this._oMaterialVH = oDialog;
            this.getView().addDependent(this._oMaterialVH);
            this._oMaterialVH.open();

        }.bind(this));

    } else {
        this._oMaterialVH.open();
    }

},

onMaterialSelect: function (oEvent) {

    let aSelectedItems = oEvent.getParameter("selectedItems");
    if (!aSelectedItems.length) return;

    let oLocalModel = this.getView().getModel("quarterlyModel");

    let aTokens = [];
    let aTableData = [];

    aSelectedItems.forEach(function (oItem) {

        let oCtx = oItem.getBindingContext("quarterlyModel");
        let oData = oCtx.getObject();

        aTokens.push({
            Material: oData.Material,
            MaterialDesc: oData.MaterialDesc
        });

        aTableData.push({
            Material: oData.Material,
            MaterialDesc: oData.MaterialDesc,
            Q1_Percentage: oData.Q1_Percentage,
            Q2_Percentage: oData.Q2_Percentage,
            Q3_Percentage: oData.Q3_Percentage,
            Q4_Percentage: oData.Q4_Percentage,
            Total:
                (parseFloat(oData.Q1_Percentage) || 0) +
                (parseFloat(oData.Q2_Percentage) || 0) +
                (parseFloat(oData.Q3_Percentage) || 0) +
                (parseFloat(oData.Q4_Percentage) || 0)
        });

    });

    oLocalModel.setProperty("/SelectedMaterials", aTokens);

    oLocalModel.setProperty("/QuarterlyData", aTableData);

    oLocalModel.setProperty("/UIState/isEditable", true);

}

    });
});