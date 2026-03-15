sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "com/ingenx/annualplan/utils/HelperFunction",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/core/ValueState",
    "sap/m/BusyDialog"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    HelperFunction,
    MessageBox,
    MessageToast,
    Fragment,
    ValueState,
    BusyDialog
) {
    "use strict";

    var _iRowIdCounter = 100;

    return Controller.extend("com.ingenx.annualplan.controller.QuarterlyPercentage", {

        onInit: function () {
            var oUiModel = new JSONModel({
                quarterlyPercentages: [],
                materialValueHelp: [],
                ui: {
                    busy       : false,
                    editMode   : false,
                    hasChanges : false,
                    saveEnabled: false
                },
                summary: {
                    totalMaterials: 0,
                    pendingRows   : 0,
                    lastSavedOn   : "",
                    lastSavedBy   : ""
                }
            });
            this.getView().setModel(oUiModel, "qtrPct");

            this._oOriginalData        = null;
            this._oMaterialVHDialog    = null;
            this._oAddMatDialog        = null;
            this._oValidationInfoDialog = null;
            this._iVHRowIndex          = -1;

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("onRouteQuarterlyPercentage")
                   .attachPatternMatched(this._onPatternMatched, this);
        },

        //  ROUTE MATCHED — Load data from OData
        _onPatternMatched: async function () {
            this._showBusy("Loading quarterly data…");
            try {
                await this._loadTableData();
            } catch (oErr) {
                MessageBox.error("Failed to load data: " + oErr.message);
            } finally {
                this._hideBusy();
            }
        },

        // ── Fetch flat rows from OData, group into table rows
        _loadTableData: async function () {
            var oODataModel = this.getOwnerComponent().getModel();
            var oBindList   = oODataModel.bindList("/xGMSxANNUAL_QT");
            var aContexts   = await oBindList.requestContexts(0, 1000);
            var aFlat       = aContexts.map(function (oCtx) { return oCtx.getObject(); });

            // Group: Material + ValidFrom + ValidTo → one table row
            var mGrouped = {};
            aFlat.forEach(function (oItem) {
                var sKey = oItem.Material + "_" + oItem.ValidFrom + "_" + oItem.ValidTo;
                if (!mGrouped[sKey]) {
                    mGrouped[sKey] = {
                        material    : oItem.Material,
                        materialDesc: "",               
                        validFrom   : oItem.ValidFrom, 
                        validTo     : oItem.ValidTo,
                        startDate   : oItem.ValidFrom,
                        endDate     : oItem.ValidTo,
                        q1Pct       : 0,
                        q2Pct       : 0,
                        q3Pct       : 0,
                        q4Pct       : 0,
                        total       : 0,
                        totalState  : "None",
                        isNew       : false,
                        isEditable  : false,
                        lastUpdatedBy: oItem.Changedby  || oItem.Createdby  || "",
                        lastUpdatedOn: oItem.Changeddate || oItem.Createddate || "",

                        _rawValidFrom: oItem.ValidFrom,
                        _rawValidTo  : oItem.ValidTo,
                        materialState    : ValueState.None,
                        materialStateText: "",
                        q1State: ValueState.None,
                        q2State: ValueState.None,
                        q3State: ValueState.None,
                        q4State: ValueState.None
                    };
                }
                // Map Q1/Q2/Q3/Q4
                var fVal = parseFloat(oItem.Value) || 0;
                switch (oItem.Subinterval) {
                    case "Q1": mGrouped[sKey].q1Pct = fVal; break;
                    case "Q2": mGrouped[sKey].q2Pct = fVal; break;
                    case "Q3": mGrouped[sKey].q3Pct = fVal; break;
                    case "Q4": mGrouped[sKey].q4Pct = fVal; break;
                }
            });

            var aRows = Object.values(mGrouped);
            aRows.forEach(function (oRow) {
                var tot = oRow.q1Pct + oRow.q2Pct + oRow.q3Pct + oRow.q4Pct;
                oRow.total      = tot;
                oRow.totalState = tot === 100 ? "Success" : tot > 100 ? "Error" : "Warning";
            });

            var oModel = this._getModel();
            oModel.setProperty("/quarterlyPercentages", aRows);
            oModel.setProperty("/summary/totalMaterials", aRows.length);
            this._aAllRows = null;   
            this._addRowIndexes();

            var oMCB = this.byId("materialMultiInput");
            if (oMCB) { oMCB.setSelectedKeys([]); }
        },

        onMaterialVHSearch : function(oEvent){
           HelperFunction._valueHelpLiveSearch(oEvent,["Material","MaterialDesc"])
        },

        //  ADD MATERIAL DIALOG
        onAddRow: function () {
            this._resetAddMatDialog();

            if (!this._oAddMatDialog) {
                Fragment.load({
                    id:         this.getView().getId(),
                    name:       "com.ingenx.annualplan.fragments.AddMaterialDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oAddMatDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this._oAddMatDialog.open();
            }
        },

        _resetAddMatDialog: function () {
            var oDialogModel = new JSONModel({
                material    : "",
                materialDesc: "",
                materialType: "",
                validFrom   : "",
                validTo     : "",
                q1Pct       : 25,
                q2Pct       : 25,
                q3Pct       : 25,
                q4Pct       : 25,
                total       : 100,
                totalState  : "Success",
                validationMsg: "",
                state: {
                    material : "None",
                    validFrom: "None",
                    validTo  : "None",
                    q1: "None", q2: "None", q3: "None", q4: "None"
                }
            });
            this.getView().setModel(oDialogModel, "addMat");
        },

        onAddMatPctChange: function () {
            var oM  = this.getView().getModel("addMat");
            var tot = (parseFloat(oM.getProperty("/q1Pct")) || 0)
                    + (parseFloat(oM.getProperty("/q2Pct")) || 0)
                    + (parseFloat(oM.getProperty("/q3Pct")) || 0)
                    + (parseFloat(oM.getProperty("/q4Pct")) || 0);
            oM.setProperty("/total",       tot);
            oM.setProperty("/totalState",  tot === 100 ? "Success" : tot > 100 ? "Error" : "Warning");
            oM.setProperty("/validationMsg", "");
        },

        onAddMatDateChange: function () {
            var oM = this.getView().getModel("addMat");
            oM.setProperty("/state/validFrom", "None");
            oM.setProperty("/state/validTo",   "None");
            oM.setProperty("/validationMsg",   "");
        },

        onAddMatVH: function () {
            this._iVHRowIndex = null; 
            this._openMaterialVH();
        },

        _validateAddMatDialog: function () {
            var oM      = this.getView().getModel("addMat");
            var aErrors = [];

            if (!oM.getProperty("/material")) {
                oM.setProperty("/state/material", "Error");
                aErrors.push("Material is required.");
            }
            if (!oM.getProperty("/validFrom")) {
                oM.setProperty("/state/validFrom", "Error");
                aErrors.push("Valid From is required.");
            }
            if (!oM.getProperty("/validTo")) {
                oM.setProperty("/state/validTo", "Error");
                aErrors.push("Valid To is required.");
            }
            var sFrom = oM.getProperty("/validFrom");
            var sTo   = oM.getProperty("/validTo");
            if (sFrom && sTo && sFrom >= sTo) {
                oM.setProperty("/state/validFrom", "Error");
                oM.setProperty("/state/validTo",   "Error");
                aErrors.push("Valid From must be before Valid To.");
            }
            var tot = parseFloat(oM.getProperty("/total")) || 0;
            if (tot !== 100) {
                ["q1","q2","q3","q4"].forEach(function (q) {
                    oM.setProperty("/state/" + q, "Error");
                });
                aErrors.push("Q1+Q2+Q3+Q4 must equal 100%. Current: " + tot + "%");
            }

            var sMat  = oM.getProperty("/material");
            var aRows = this._getModel().getProperty("/quarterlyPercentages") || [];
            if (aRows.some(function (r) {
                return r.material && r.material.toUpperCase() === sMat.toUpperCase();
            })) {
                oM.setProperty("/state/material", "Error");
                aErrors.push("Material '" + sMat + "' already exists.");
            }
            return aErrors;
        },

        // POST new material
        onAddMatSave: function () {
            var aErrors = this._validateAddMatDialog();
            if (aErrors.length > 0) {
                this.getView().getModel("addMat")
                    .setProperty("/validationMsg", aErrors.join(" | "));
                return;
            }

            var oM       = this.getView().getModel("addMat");
            var sFrom    = oM.getProperty("/validFrom");
            var sTo      = oM.getProperty("/validTo");
            var sMat     = oM.getProperty("/material");

            var oPayload = {
                ValidFrom    : sFrom,
                ValidTo      : sTo,
                to_annualqtr : [
                    { ValidFrom: sFrom, ValidTo: sTo, Material: sMat, Period:"Q",Subinterval: "Q1", Value: parseFloat(oM.getProperty("/q1Pct")).toFixed(3) },
                    { ValidFrom: sFrom, ValidTo: sTo, Material: sMat, Period:"Q",Subinterval: "Q2", Value: parseFloat(oM.getProperty("/q2Pct")).toFixed(3) },
                    { ValidFrom: sFrom, ValidTo: sTo, Material: sMat, Period:"Q",Subinterval: "Q3", Value: parseFloat(oM.getProperty("/q3Pct")).toFixed(3) },
                    { ValidFrom: sFrom, ValidTo: sTo, Material: sMat, Period:"Q",Subinterval: "Q4", Value: parseFloat(oM.getProperty("/q4Pct")).toFixed(3) }
                ]
            };

            var oQtrModel   = this._getModel();
            this._showBusy("Saving material…");

            var oODataModel = this.getOwnerComponent().getModel();
            var oBindList   = oODataModel.bindList("/CreateAnnualQtrSet");
            var oContext    = oBindList.create(oPayload, true);

            oContext.created()
            .then(function () {
                this._hideBusy();
                this._oAddMatDialog.close();

                var aRows = oQtrModel.getProperty("/quarterlyPercentages") || [];
                aRows.push({
                    material    : sMat,
                    materialDesc: oM.getProperty("/materialDesc"),
                    startDate   : oM.getProperty("/validFrom"),
                    endDate     : oM.getProperty("/validTo"),
                    validFrom   : oM.getProperty("/validFrom"),
                    validTo     : oM.getProperty("/validTo"),
                    q1Pct       : parseFloat(oM.getProperty("/q1Pct")),
                    q2Pct       : parseFloat(oM.getProperty("/q2Pct")),
                    q3Pct       : parseFloat(oM.getProperty("/q3Pct")),
                    q4Pct       : parseFloat(oM.getProperty("/q4Pct")),
                    total       : 100,
                    totalState  : "Success",
                    isNew       : false,
                    isEditable  : false,
                    lastUpdatedBy: "",
                    lastUpdatedOn: this._getTodayString(),
                    materialState: ValueState.None, materialStateText: "",
                    q1State: ValueState.None, q2State: ValueState.None,
                    q3State: ValueState.None, q4State: ValueState.None
                });
                oQtrModel.setProperty("/quarterlyPercentages", aRows);
                this._addRowIndexes();
                oQtrModel.setProperty("/summary/totalMaterials", aRows.length);

                MessageBox.success("Material '" + sMat + "' saved successfully.", { title: "Saved" });
            }.bind(this))
            .catch(function (oErr) {
                this._hideBusy();
                var sMsg = (oErr && oErr.message) ? oErr.message : "Unknown error";
                this.getView().getModel("addMat")
                    .setProperty("/validationMsg", "Save failed: " + sMsg);
            }.bind(this));
        },

        onAddMatCancel: function () {
            if (this._oAddMatDialog) { this._oAddMatDialog.close(); }
        },


        //  EDIT MODE — Update existing rows 
        onToggleEditMode: function () {
            var oModel    = this._getModel();
            var bEditMode = oModel.getProperty("/ui/editMode");

            if (!bEditMode) {
                this._oOriginalData = jQuery.extend(
                    true, {}, { rows: oModel.getProperty("/quarterlyPercentages") }
                );
                this._iSelectedRowIndex = -1;
                oModel.setProperty("/ui/editMode",    true);
                oModel.setProperty("/ui/saveEnabled", true);
                MessageToast.show("Edit mode enabled. Make changes and click Save.");


            } else {
                if (oModel.getProperty("/ui/hasChanges")) {
                    MessageBox.confirm("You have unsaved changes. Discard them?", {
                        title: "Discard Changes",
                        onClose: function (sAction) {
                            if (sAction === MessageBox.Action.OK) { this._discardChanges(); }
                        }.bind(this)
                    });
                } else {
                    this._exitEditMode();
                }
            }
        },

        onSave: function () {
            var aErrors = this._validateAll();
            if (aErrors.length > 0) {
                var sMsg = "Please fix the following errors:\n\n";
                aErrors.forEach(function (s, i) { sMsg += (i + 1) + ". " + s + "\n"; });
                MessageBox.error(sMsg, { title: "Validation Failed" });
                return;
            }

            var oModel = this._getModel();
            var aRows  = oModel.getProperty("/quarterlyPercentages");  
            var sMaterials = aRows.map(function (r) { return r.material; }).join(", ");
            MessageBox.confirm(
                "Save quarterly percentages for: " + sMaterials + "?",
                {
                    title: "Confirm Save",
                    icon : MessageBox.Icon.SUCCESS,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) { this._persistData(); }
                    }.bind(this)
                }
            );
        },

        // PATCH all rows via AnnualQtrpSet
        _persistData: function () {
            var oUiModel  = this._getModel();
            var aRows     = oUiModel.getProperty("/quarterlyPercentages");  

            if (!aRows || aRows.length === 0) {
                MessageToast.show("No data to save.");
                return;
            }

            this._showBusy("Saving data…");

            var oODataModel = this.getOwnerComponent().getModel();

            // Group rows by ValidFrom+ValidTo
            var mGroups = {};
            aRows.forEach(function (oRow) {
                var sFrom = (oRow._rawValidFrom || oRow.validFrom || oRow.startDate || "");
                var sTo   = (oRow._rawValidTo   || oRow.validTo   || oRow.endDate   || "");
                if (sFrom && !sFrom.includes("T")) { sFrom = sFrom + "T00:00:00"; }
                if (sTo   && !sTo.includes("T"))   { sTo   = sTo   + "T00:00:00"; }

                var sKey = sFrom + "_" + sTo;
                if (!mGroups[sKey]) {
                    mGroups[sKey] = { ValidFrom: sFrom, ValidTo: sTo, to_annualqtr: [] };
                }
                ["Q1","Q2","Q3","Q4"].forEach(function (sPeriod) {
                    var sPctKey = "q" + sPeriod[1] + "Pct";

                mGroups[sKey].to_annualqtr.push({
                    ValidFrom   : sFrom,
                    ValidTo     : sTo,
                    Material    : oRow.material,
                    Period      : "Q",          // fixed
                    Subinterval : sPeriod,      // Q1,Q2,Q3,Q4
                    Value       : Number(oRow[sPctKey] || 0).toFixed(3)
                });
                });
            });

            var aPromises = Object.values(mGroups).map(function (oPayload) {
                console.log("Payload going to backend:", JSON.stringify(oPayload, null, 2));
                return new Promise(function (resolve, reject) {
                    var oBindList = oODataModel.bindList("/CreateAnnualQtrSet");
                    var oContext  = oBindList.create(oPayload, true);  
                    oContext.created()
                        .then(resolve)
                        .catch(reject);
                });
            });

            Promise.all(aPromises)
                .then(function () {
                    this._hideBusy();
                    this._onSaveSuccess();
                }.bind(this))
                .catch(function (oErr) {
                    this._hideBusy();
                    this._onSaveError(oErr);
                }.bind(this));
        },

        //  DELETE ROW
        onDeleteRow: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("qtrPct");
            var sPath    = oContext.getPath();
            var oRow     = oContext.getObject();

            if (oRow.isNew) { this._removeRow(sPath); return; }

            MessageBox.confirm(
                "Delete quarterly percentages for material '" + oRow.material + "'?\nThis cannot be undone.",
                {
                    title: "Delete Row", icon: MessageBox.Icon.WARNING,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            this._removeRow(sPath);
                            MessageToast.show("Row deleted. Click Save to persist.");
                        }
                    }.bind(this)
                }
            );
        },

        //  MATERIAL VALUE HELP
        onMaterialValueHelp: function (oEvent) {
            this._iVHRowIndex = oEvent.getSource().getBindingContext("qtrPct").getPath();
            this._openMaterialVH();
        },

        _openMaterialVH: function () {
            if (!this._oMaterialVHDialog) {
                Fragment.load({
                    id:         this.getView().getId(),
                    name:       "com.ingenx.annualplan.fragments.MaterialValueHelp",
                    controller: this
                }).then(function (oDialog) {
                    this._oMaterialVHDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this._oMaterialVHDialog.open();
            }
        },

        onMaterialVHSearch: function (oEvent) {
            var sValue  = oEvent.getParameter("value");
            var oFilter = new Filter({
                filters: [
                    new Filter("Material",     FilterOperator.Contains, sValue),
                    new Filter("MaterialDesc", FilterOperator.Contains, sValue)
                ],
                and: false
            });
            oEvent.getSource().getBinding("items").filter([oFilter]);
        },

        onMaterialVHConfirm: function (oEvent) {
            var oSelected = oEvent.getParameter("selectedItem");
            if (!oSelected) return;

            var oCtx  = oSelected.getBindingContext();
            var oMat  = oCtx ? oCtx.getObject() : null;
            var sMat  = oMat ? oMat.Material     : oSelected.getTitle();
            var sDesc = oMat ? oMat.MaterialDesc  : oSelected.getDescription();

            if (this._iVHRowIndex === null) {
                var aExisting = this._getModel().getProperty("/quarterlyPercentages") || [];
                var bDuplicate = aExisting.some(function (oRow) {
                    return oRow.material && oRow.material.toUpperCase() === sMat.toUpperCase();
                });

                var oDialogModel = this.getView().getModel("addMat");

                if (bDuplicate) {
                    oDialogModel.setProperty("/material",      "");
                    oDialogModel.setProperty("/materialDesc",  "");
                    oDialogModel.setProperty("/state/material", "Error");
                    oDialogModel.setProperty("/validationMsg",
                        "Material '" + sMat + "' already has quarterly limits configured. Please select a different material.");
                    return;
                }

                oDialogModel.setProperty("/material",      sMat);
                oDialogModel.setProperty("/materialDesc",  sDesc);
                oDialogModel.setProperty("/state/material", "None");
                oDialogModel.setProperty("/validationMsg",  "");
            } else {
                var oModel = this._getModel();
                oModel.setProperty(this._iVHRowIndex + "/material",     sMat);
                oModel.setProperty(this._iVHRowIndex + "/materialDesc", sDesc);
                this._setHasChanges(true);
            }
        },

        onMaterialVHCancel: function () { /* SelectDialog auto closes */ },

        //  FIELD / PCT CHANGE HANDLERS
        onFieldChange: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("qtrPct");
            if (!oContext) return;
            this._getModel().setProperty(oContext.getPath() + "/materialState", ValueState.None);
            this._setHasChanges(true);
        },

        onPctChange: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("qtrPct");
            if (!oContext) return;
            this._recalcRowTotal(oContext.getPath());
            this._setHasChanges(true);
        },

        //  OTHER UI HANDLERS
        onCancelEdit: function () {
            var oModel = this._getModel();
            if (oModel.getProperty("/ui/hasChanges")) {
                MessageBox.confirm("Discard all unsaved changes?", {
                    title: "Discard Changes",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) { this._discardChanges(); }
                    }.bind(this)
                });
            } else {
                this._exitEditMode();
            }
        },

        onShowValidationInfo: function () {
            if (!this._oValidationInfoDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.ingenx.annualplan.fragments.ValidationInfoDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oValidationInfoDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this._oValidationInfoDialog.open();
            }
        },

        onCloseValidationInfo: function () {
            if (this._oValidationInfoDialog) { this._oValidationInfoDialog.close(); }
        },

        onRefresh: function () {
            var oModel = this._getModel();
            if (oModel.getProperty("/ui/hasChanges")) {
                MessageBox.confirm("Refreshing will discard unsaved changes. Continue?", {
                    title: "Refresh Data",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            this._discardChanges();
                            this._onPatternMatched();
                        }
                    }.bind(this)
                });
            } else {
                this._onPatternMatched();
            }
        },

        onExport: function () {
            MessageToast.show("Export - connect to sap.ui.export.Spreadsheet.");
        },

        onTilePress: function () {},

        // MultiComboBox filter
        onMaterialFilterChange: function (oEvent) {
            var aSelectedItems = oEvent.getParameter("selectedItems");
            var oModel         = this._getModel();

            if (!aSelectedItems || aSelectedItems.length === 0) {
                oModel.setProperty("/quarterlyPercentages",
                    this._aAllRows || oModel.getProperty("/quarterlyPercentages"));
                this._aAllRows = null;
                oModel.setProperty("/summary/totalMaterials",
                    oModel.getProperty("/quarterlyPercentages").length);
                return;
            }

            var aKeys = aSelectedItems.map(function (oItem) {
                return oItem.getKey().toUpperCase();
            });

            if (!this._aAllRows) {
                this._aAllRows = oModel.getProperty("/quarterlyPercentages").slice();
            }

            var aFiltered = this._aAllRows.filter(function (oRow) {
                return aKeys.indexOf(oRow.material.toUpperCase()) !== -1;
            });

            oModel.setProperty("/quarterlyPercentages", aFiltered);
            oModel.setProperty("/summary/totalMaterials", aFiltered.length);
            this._addRowIndexes();
        },

        //  PRIVATE HELPERS
        _getModel: function () {
            return this.getView().getModel("qtrPct");
        },

        _showBusy: function (sMsg) {
            if (!this._oBusyDialog) {
                this._oBusyDialog = new BusyDialog({
                    title  : "Please Wait",
                    text   : sMsg || "Loading data…"
                });
            } else {
                this._oBusyDialog.setText(sMsg || "Loading data…");
            }
            this._oBusyDialog.open();
        },

        _hideBusy: function () {
            if (this._oBusyDialog) {
                this._oBusyDialog.close();
            }
        },

        _recalcRowTotal: function (sRowPath) {
            var oModel = this._getModel();
            var total  = (parseFloat(oModel.getProperty(sRowPath + "/q1Pct")) || 0)
                       + (parseFloat(oModel.getProperty(sRowPath + "/q2Pct")) || 0)
                       + (parseFloat(oModel.getProperty(sRowPath + "/q3Pct")) || 0)
                       + (parseFloat(oModel.getProperty(sRowPath + "/q4Pct")) || 0);
            oModel.setProperty(sRowPath + "/total",      total);
            oModel.setProperty(sRowPath + "/totalState",
                total === 100 ? "Success" : total > 100 ? "Error" : "Warning");
        },

        // Validate a single row by index 
        _validateRow: function (iIdx) {
            var oModel  = this._getModel();
            var aRows   = oModel.getProperty("/quarterlyPercentages");
            var oRow    = aRows[iIdx];
            var sPath   = "/quarterlyPercentages/" + iIdx;
            var aErrors = [];

            if (!oRow.material || !oRow.material.trim()) {
                aErrors.push("Material is required.");
                oModel.setProperty(sPath + "/materialState",     ValueState.Error);
                oModel.setProperty(sPath + "/materialStateText", "Required.");
            } else {
                oModel.setProperty(sPath + "/materialState", ValueState.None);
            }

            [["q1Pct","q1State","Q1"],["q2Pct","q2State","Q2"],
             ["q3Pct","q3State","Q3"],["q4Pct","q4State","Q4"]].forEach(function (aF) {
                var val = parseFloat(oRow[aF[0]]);
                if (isNaN(val) || val <= 0 || val > 100) {
                    aErrors.push(aF[2] + "% must be between 1 and 100.");
                    oModel.setProperty(sPath + "/" + aF[1], ValueState.Error);
                } else {
                    oModel.setProperty(sPath + "/" + aF[1], ValueState.None);
                }
            });

            var tot = (parseFloat(oRow.q1Pct)||0) + (parseFloat(oRow.q2Pct)||0)
                    + (parseFloat(oRow.q3Pct)||0) + (parseFloat(oRow.q4Pct)||0);
            if (tot !== 100) {
                aErrors.push("Q1+Q2+Q3+Q4 = " + tot + "%. Must be exactly 100%.");
                ["q1State","q2State","q3State","q4State"].forEach(function (k) {
                    oModel.setProperty(sPath + "/" + k, ValueState.Error);
                });
            }
            return aErrors;
        },

        _validateAll: function () {
            var oModel  = this._getModel();
            var aRows   = oModel.getProperty("/quarterlyPercentages");
            var aErrors = [];
            var oSeen   = {};

            aRows.forEach(function (oRow, i) {
                var sPath = "/quarterlyPercentages/" + i;

                if (!oRow.material || !oRow.material.trim()) {
                    aErrors.push("Row " + (i+1) + ": Material is required.");
                    oModel.setProperty(sPath + "/materialState",     ValueState.Error);
                    oModel.setProperty(sPath + "/materialStateText", "Required.");
                } else {
                    oModel.setProperty(sPath + "/materialState", ValueState.None);
                }

                if (oRow.material) {
                    var sKey = oRow.material.toUpperCase();
                    if (oSeen[sKey]) {
                        aErrors.push("Row " + (i+1) + ": Duplicate material '" + oRow.material + "'.");
                        oModel.setProperty(sPath + "/materialState", ValueState.Error);
                    }
                    oSeen[sKey] = true;
                }

                [["q1Pct","q1State","Q1"],["q2Pct","q2State","Q2"],
                 ["q3Pct","q3State","Q3"],["q4Pct","q4State","Q4"]].forEach(function (aF) {
                    var val = parseFloat(oRow[aF[0]]);
                    if (isNaN(val) || val <= 0 || val > 100) {
                        aErrors.push("Row " + (i+1) + ": " + aF[2] + "% must be 1–100.");
                        oModel.setProperty(sPath + "/" + aF[1], ValueState.Error);
                    } else {
                        oModel.setProperty(sPath + "/" + aF[1], ValueState.None);
                    }
                });

                var tot = (parseFloat(oRow.q1Pct)||0) + (parseFloat(oRow.q2Pct)||0)
                        + (parseFloat(oRow.q3Pct)||0) + (parseFloat(oRow.q4Pct)||0);
                if (tot !== 100) {
                    aErrors.push("Row " + (i+1) + " (" + oRow.material + "): Total = " + tot + "%. Must be 100%.");
                    ["q1State","q2State","q3State","q4State"].forEach(function (k) {
                        oModel.setProperty(sPath + "/" + k, ValueState.Error);
                    });
                }
            });

            return aErrors;
        },

        _onSaveSuccess: function () {
            var oModel = this._getModel();
            var aRows  = oModel.getProperty("/quarterlyPercentages");
            var sToday = this._getTodayString();

            aRows.forEach(function (oRow, i) {
                oModel.setProperty("/quarterlyPercentages/" + i + "/isNew",         false);
                oModel.setProperty("/quarterlyPercentages/" + i + "/isEditable",    false);
                oModel.setProperty("/quarterlyPercentages/" + i + "/lastUpdatedBy", "Current User");
                oModel.setProperty("/quarterlyPercentages/" + i + "/lastUpdatedOn", sToday);
                ["materialState","q1State","q2State","q3State","q4State"].forEach(function (k) {
                    oModel.setProperty("/quarterlyPercentages/" + i + "/" + k, ValueState.None);
                });
            });

            oModel.setProperty("/summary/totalMaterials", aRows.length);
            oModel.setProperty("/summary/lastSavedOn",    sToday);
            oModel.setProperty("/summary/lastSavedBy",    "Current User");
            oModel.setProperty("/summary/pendingRows",    0);
            this._exitEditMode();

            MessageBox.success(
                "Saved successfully for " + aRows.length + " material(s).",
                { title: "Saved Successfully" }
            );
        },

        _onSaveError: function (oErr) {
            MessageBox.error(
                "Save failed.\n\n" + (oErr && oErr.message ? oErr.message : ""),
                { title: "Save Failed" }
            );
        },

        _exitEditMode: function () {
            var oModel = this._getModel();
            oModel.setProperty("/ui/editMode",    false);
            oModel.setProperty("/ui/hasChanges",  false);
            oModel.setProperty("/ui/saveEnabled", false);
            this._oOriginalData = null;
        },

        _discardChanges: function () {
            if (this._oOriginalData) {
                this._getModel().setProperty("/quarterlyPercentages", this._oOriginalData.rows);
                this._addRowIndexes();
            }
            this._exitEditMode();
            MessageToast.show("Changes discarded.");
        },

        _setHasChanges: function (bValue) {
            this._getModel().setProperty("/ui/hasChanges",  bValue);
            this._getModel().setProperty("/ui/saveEnabled", bValue);
        },

        _addRowIndexes: function () {
            var oModel = this._getModel();
            var aRows  = oModel.getProperty("/quarterlyPercentages") || [];
            aRows.forEach(function (oRow, i) { oRow.__index = i + 1; });
            oModel.setProperty("/quarterlyPercentages", aRows);
        },

        _removeRow: function (sPath) {
            var oModel = this._getModel();
            var aRows  = oModel.getProperty("/quarterlyPercentages");
            aRows.splice(parseInt(sPath.split("/").pop(), 10), 1);
            oModel.setProperty("/quarterlyPercentages", aRows);
            this._addRowIndexes();
            this._setHasChanges(true);
            oModel.setProperty("/summary/totalMaterials", aRows.length);
        },

        _updateSummaryPendingCount: function () {
            var oModel   = this._getModel();
            var aRows    = oModel.getProperty("/quarterlyPercentages") || [];
            oModel.setProperty("/summary/pendingRows",    aRows.filter(function (r) { return r.isNew; }).length);
            oModel.setProperty("/summary/totalMaterials", aRows.length);
        },

        _markUsedMaterials: function () {
            // No-op when using OData VH — alreadyUsed not needed
            // Keep for backward compat if JSON VH still used somewhere
        },

        _getTodayString: function () {
            var d  = new Date();
            var mm = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            return d.getDate() + " " + mm[d.getMonth()] + " " + d.getFullYear();
        }

    });
});