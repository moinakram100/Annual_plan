sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/core/ValueState"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageBox,
    MessageToast,
    Fragment,
    ValueState
) {
    "use strict";

    var _iRowIdCounter = 100;

    return Controller.extend("com.ingenx.annualplan.controller.QuarterlyPercentage", {
        onInit: function () {
            var oModel = new JSONModel(
                sap.ui.require.toUrl("com/ingenx/annualplan/model/qtrPctPlan.json")
            );
            oModel.attachRequestCompleted(function () {
                this._addRowIndexes();
                this._markUsedMaterials();
            }.bind(this));
            this.getView().setModel(oModel, "qtrPct");
            this._oOriginalData = null;
            this._oMaterialVHDialog     = null;
            this._oValidationInfoDialog = null;
            this._iVHRowIndex = -1;
        },

       
        onToggleEditMode: function () {
            var oModel    = this._getModel();
            var bEditMode = oModel.getProperty("/ui/editMode");

            if (!bEditMode) {
                this._oOriginalData = jQuery.extend(
                    true, {}, { rows: oModel.getProperty("/quarterlyPercentages") }
                );
                oModel.setProperty("/ui/editMode", true);
                MessageToast.show("Edit mode enabled. Make changes and click Save.");
            } else {
                if (oModel.getProperty("/ui/hasChanges")) {
                    MessageBox.confirm(
                        "You have unsaved changes. Are you sure you want to discard them?",
                        {
                            title: "Discard Changes",
                            onClose: function (sAction) {
                                if (sAction === MessageBox.Action.OK) {
                                    this._discardChanges();
                                }
                            }.bind(this)
                        }
                    );
                } else {
                    this._exitEditMode();
                }
            }
        },

        onAddRow: function () {
            var oModel = this._getModel();
            var aRows  = oModel.getProperty("/quarterlyPercentages");

            var oNewRow = {
                id:               "ROW-NEW-" + (++_iRowIdCounter),
                material:         "",
                materialDesc:     "",
                q1Pct:            25,
                q2Pct:            25,
                q3Pct:            25,
                q4Pct:            25,
                total:            100,
                totalState:       "Success",
                isEditable:       true,
                isNew:            true,
                lastUpdatedBy:    "",
                lastUpdatedOn:    "",
                // Validation states
                materialState:    ValueState.None,
                materialStateText:"",
                q1State:          ValueState.None,
                q2State:          ValueState.None,
                q3State:          ValueState.None,
                q4State:          ValueState.None
            };

            aRows.push(oNewRow);
            oModel.setProperty("/quarterlyPercentages", aRows);
            this._addRowIndexes();
            this._setHasChanges(true);
            this._updateSummaryPendingCount();

            var oTable = this.byId("qtrPctTable");
            setTimeout(function () {
                oTable.setFirstVisibleRow(aRows.length - 1);
            }, 100);
        },

  
        onDeleteRow: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("qtrPct");
            var sPath    = oContext.getPath();
            var oRow     = oContext.getObject();

            if (oRow.isNew) {
                this._removeRow(sPath);
                return;
            }

            MessageBox.confirm(
                "Delete quarterly percentages for material '" + oRow.material + "'?\nThis cannot be undone.",
                {
                    title:   "Delete Row",
                    icon:    MessageBox.Icon.WARNING,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            this._removeRow(sPath);
                            MessageToast.show("Row deleted. Click Save to persist.");
                        }
                    }.bind(this)
                }
            );
        },

     
        onFieldChange: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("qtrPct");
            if (!oContext) return;
            var sPath = oContext.getPath();
            var oModel = this._getModel();
            oModel.setProperty(sPath + "/materialState", ValueState.None);
            this._setHasChanges(true);
        },

        onPctChange: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("qtrPct");
            if (!oContext) return;
            var sPath = oContext.getPath();
            this._recalcRowTotal(sPath);
            this._setHasChanges(true);
        },

  
        onMaterialValueHelp: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("qtrPct");
            this._iVHRowIndex = oContext.getPath(); 
            this._markUsedMaterials();

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
                    new Filter("text", FilterOperator.Contains, sValue),
                    new Filter("desc", FilterOperator.Contains, sValue)
                ],
                and: false
            });
            oEvent.getSource().getBinding("items").filter([oFilter]);
        },

        onMaterialVHConfirm: function (oEvent) {
            var oSelected = oEvent.getParameter("selectedItem");
            if (!oSelected) return;

            var oModel  = this._getModel();
            var sKey    = oSelected.getBindingContext("qtrPct").getProperty("key");
            var sDesc   = oSelected.getBindingContext("qtrPct").getProperty("desc");

            oModel.setProperty(this._iVHRowIndex + "/material",     sKey);
            oModel.setProperty(this._iVHRowIndex + "/materialDesc",  sDesc);
            oModel.setProperty(this._iVHRowIndex + "/materialState", ValueState.None);

            this._markUsedMaterials();
            this._setHasChanges(true);
        },

        /** Cancel VH dialog */
        onMaterialVHCancel: function () {
            // Nothing to do – dialog closes automatically
        },

     
        onSave: function () {
            var aErrors = this._validateAll();

            if (aErrors.length > 0) {
                var sMsg = "Please fix the following errors before saving:\n\n";
                aErrors.forEach(function (sErr, i) {
                    sMsg += (i + 1) + ". " + sErr + "\n";
                });
                MessageBox.error(sMsg, { title: "Validation Failed" });
                return;
            }

            var oModel = this._getModel();
            var aRows  = oModel.getProperty("/quarterlyPercentages");
            MessageBox.confirm(
                "Save quarterly percentages for " + aRows.length + " material(s)?\n\n" +
                "All Zonal Offices will be notified via email.",
                {
                    title: "Confirm Save",
                    icon:  MessageBox.Icon.SUCCESS,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            this._persistData();
                        }
                    }.bind(this)
                }
            );
        },

        onCancelEdit: function () {
            var oModel = this._getModel();
            if (oModel.getProperty("/ui/hasChanges")) {
                MessageBox.confirm(
                    "Discard all unsaved changes?",
                    {
                        title: "Discard Changes",
                        onClose: function (sAction) {
                            if (sAction === MessageBox.Action.OK) {
                                this._discardChanges();
                            }
                        }.bind(this)
                    }
                );
            } else {
                this._exitEditMode();
            }
        },

        onShowValidationInfo: function () {
            if (!this._oValidationInfoDialog) {
                Fragment.load({
                    id:         this.getView().getId(),
                    name:       "com.ingenx.annualplan.fragments.ValidationInfoDialog",
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
            if (this._oValidationInfoDialog) {
                this._oValidationInfoDialog.close();
            }
        },

        onExport: function () {
            MessageToast.show("Export - connect to sap.ui.export.Spreadsheet.");
        },

        onRefresh: function () {
            var oModel = this._getModel();
            if (oModel.getProperty("/ui/hasChanges")) {
                MessageBox.confirm(
                    "Refreshing will discard your unsaved changes. Continue?",
                    {
                        title: "Refresh Data",
                        onClose: function (sAction) {
                            if (sAction === MessageBox.Action.OK) {
                                this._discardChanges();
                                MessageToast.show("Data refreshed.");
                            }
                        }.bind(this)
                    }
                );
            } else {
                oModel.setProperty("/ui/busy", true);
                setTimeout(function () {
                    oModel.setProperty("/ui/busy", false);
                    MessageToast.show("Data refreshed.");
                }, 600);
            }
        },

        onTilePress: function () {
            // Tile press – no action needed
        },

        // ════════════════════════════════════════════════════════════════════
        //  PRIVATE HELPERS
        // ════════════════════════════════════════════════════════════════════

        /** Convenience getter for the qtrPct model */
        _getModel: function () {
            return this.getView().getModel("qtrPct");
        },

        /**
         * Recalculate total % for a given row path and update ObjectStatus state.
         * State: Success (=100) | Warning (>100 but ≤ 110) | Error (≠100 outside range)
         * @param {string} sRowPath - e.g. "/quarterlyPercentages/0"
         */
        _recalcRowTotal: function (sRowPath) {
            var oModel = this._getModel();
            var q1 = parseFloat(oModel.getProperty(sRowPath + "/q1Pct")) || 0;
            var q2 = parseFloat(oModel.getProperty(sRowPath + "/q2Pct")) || 0;
            var q3 = parseFloat(oModel.getProperty(sRowPath + "/q3Pct")) || 0;
            var q4 = parseFloat(oModel.getProperty(sRowPath + "/q4Pct")) || 0;

            var total = q1 + q2 + q3 + q4;
            var sState;
            if (total === 100) {
                sState = "Success";
            } else if (total > 100 && total <= 110) {
                sState = "Warning";
            } else {
                sState = "Error";
            }

            oModel.setProperty(sRowPath + "/total",      total);
            oModel.setProperty(sRowPath + "/totalState", sState);
        },

        /**
         * Full validation pass across all rows.
         * Sets per-field ValueState for inline error highlighting.
         * @returns {string[]} Array of human-readable error messages
         */
        _validateAll: function () {
            var oModel  = this._getModel();
            var aRows   = oModel.getProperty("/quarterlyPercentages");
            var aErrors = [];
            var oSeen   = {};  // material dedup check

            aRows.forEach(function (oRow, i) {
                var sPath = "/quarterlyPercentages/" + i;
                var sNum  = (i + 1);

                // 1. Material mandatory
                if (!oRow.material || oRow.material.trim() === "") {
                    aErrors.push("Row " + sNum + ": Material is required.");
                    oModel.setProperty(sPath + "/materialState",     ValueState.Error);
                    oModel.setProperty(sPath + "/materialStateText", "Material is required.");
                } else {
                    oModel.setProperty(sPath + "/materialState", ValueState.None);
                }

                // 2. Duplicate material check
                if (oRow.material) {
                    var sKey = oRow.material.toUpperCase();
                    if (oSeen[sKey]) {
                        aErrors.push("Row " + sNum + ": Duplicate material '" + oRow.material + "'.");
                        oModel.setProperty(sPath + "/materialState",     ValueState.Error);
                        oModel.setProperty(sPath + "/materialStateText", "Duplicate material.");
                    }
                    oSeen[sKey] = true;
                }

                // 3. Each % must be numeric and > 0
                var fields = [
                    { key: "q1Pct", stateKey: "q1State", label: "Q1" },
                    { key: "q2Pct", stateKey: "q2State", label: "Q2" },
                    { key: "q3Pct", stateKey: "q3State", label: "Q3" },
                    { key: "q4Pct", stateKey: "q4State", label: "Q4" }
                ];
                fields.forEach(function (oField) {
                    var val = parseFloat(oRow[oField.key]);
                    if (isNaN(val) || val <= 0 || val > 100) {
                        aErrors.push("Row " + sNum + ": " + oField.label + "% must be > 0 and ≤ 100.");
                        oModel.setProperty(sPath + "/" + oField.stateKey, ValueState.Error);
                    } else {
                        oModel.setProperty(sPath + "/" + oField.stateKey, ValueState.None);
                    }
                });

                // 4. Sum must equal 100
                var q1 = parseFloat(oRow.q1Pct) || 0;
                var q2 = parseFloat(oRow.q2Pct) || 0;
                var q3 = parseFloat(oRow.q3Pct) || 0;
                var q4 = parseFloat(oRow.q4Pct) || 0;
                if (q1 + q2 + q3 + q4 !== 100) {
                    aErrors.push(
                        "Row " + sNum + " (" + oRow.material + "): Q1+Q2+Q3+Q4 = " +
                        (q1 + q2 + q3 + q4) + "%. Must equal exactly 100%."
                    );
                    // Mark all four fields as error
                    ["q1State", "q2State", "q3State", "q4State"].forEach(function (k) {
                        oModel.setProperty(sPath + "/" + k, ValueState.Error);
                    });
                }

            });

            return aErrors;
        },

        /**
         * Persist data (CAPM OData call stub).
         * In a real CAPM app, call an OData batch or action here.
         */
        _persistData: function () {
            var oModel = this._getModel();
            oModel.setProperty("/ui/busy", true);

            // ── CAPM / OData stub ──────────────────────────────────────────
            // Replace with:
            //   var oODataModel = this.getOwnerComponent().getModel("mainService");
            //   oODataModel.submitBatch("quarterlyPctGroup")
            //       .then(this._onSaveSuccess.bind(this))
            //       .catch(this._onSaveError.bind(this));
            // ─────────────────────────────────────────────────────────────

            setTimeout(function () {
                oModel.setProperty("/ui/busy", false);
                this._onSaveSuccess();
            }.bind(this), 800);
        },

        /**
         * Post-save success handler.
         * Updates last saved info, clears change flags, sends notification.
         */
        _onSaveSuccess: function () {
            var oModel = this._getModel();
            var aRows  = oModel.getProperty("/quarterlyPercentages");
            var sToday = this._getTodayString();

            // Stamp all rows with updated metadata and clear isNew
            aRows.forEach(function (oRow, i) {
                oModel.setProperty("/quarterlyPercentages/" + i + "/isNew",          false);
                oModel.setProperty("/quarterlyPercentages/" + i + "/isEditable",     false);
                oModel.setProperty("/quarterlyPercentages/" + i + "/lastUpdatedBy",  "Current User");
                oModel.setProperty("/quarterlyPercentages/" + i + "/lastUpdatedOn",  sToday);
                // Clear validation states
                ["materialState","q1State","q2State","q3State","q4State"].forEach(function (k) {
                    oModel.setProperty("/quarterlyPercentages/" + i + "/" + k, ValueState.None);
                });
            });

            // Update summary
            oModel.setProperty("/summary/totalMaterials",  aRows.length);
            oModel.setProperty("/summary/lastSavedOn",     sToday);
            oModel.setProperty("/summary/lastSavedBy",     "Current User");
            oModel.setProperty("/summary/pendingRows",     0);

            this._exitEditMode();

            MessageBox.success(
                "Quarterly percentages saved successfully for " + aRows.length + " material(s).\n\n" +
                "Email notification has been sent to all Zonal Offices.",
                { title: "Saved Successfully" }
            );
        },

        _onSaveError: function (oError) {
            var oModel = this._getModel();
            oModel.setProperty("/ui/busy", false);
            MessageBox.error(
                "Failed to save data. Please try again.\n\n" + (oError.message || ""),
                { title: "Save Failed" }
            );
        },

        /** Exit edit mode and clear all flags */
        _exitEditMode: function () {
            var oModel = this._getModel();
            oModel.setProperty("/ui/editMode",   false);
            oModel.setProperty("/ui/hasChanges", false);
            oModel.setProperty("/ui/saveEnabled",false);
            this._oOriginalData = null;
        },

        /** Restore snapshot and exit edit mode */
        _discardChanges: function () {
            if (this._oOriginalData) {
                var oModel = this._getModel();
                oModel.setProperty("/quarterlyPercentages", this._oOriginalData.rows);
                this._addRowIndexes();
            }
            this._exitEditMode();
            MessageToast.show("Changes discarded.");
        },

        /** Set hasChanges and enable Save button */
        _setHasChanges: function (bValue) {
            var oModel = this._getModel();
            oModel.setProperty("/ui/hasChanges",  bValue);
            oModel.setProperty("/ui/saveEnabled", bValue);
        },

        /**
         * Add __index (1-based) property to each row for the # column.
         */
        _addRowIndexes: function () {
            var oModel = this._getModel();
            var aRows  = oModel.getProperty("/quarterlyPercentages") || [];
            aRows.forEach(function (oRow, i) {
                oRow.__index = i + 1;
            });
            oModel.setProperty("/quarterlyPercentages", aRows);
        },

        /**
         * Mark materials already in use in the Value Help list (to prevent duplicates).
         */
        _markUsedMaterials: function () {
            var oModel    = this._getModel();
            var aRows     = oModel.getProperty("/quarterlyPercentages") || [];
            var aVH       = oModel.getProperty("/materialValueHelp") || [];
            var oUsed     = {};

            aRows.forEach(function (r) {
                if (r.material) oUsed[r.material.toUpperCase()] = true;
            });

            aVH.forEach(function (oVH, i) {
                oModel.setProperty(
                    "/materialValueHelp/" + i + "/alreadyUsed",
                    !!oUsed[oVH.key.toUpperCase()]
                );
            });
        },

        /**
         * Remove a row from the array by its path.
         * @param {string} sPath - e.g. "/quarterlyPercentages/2"
         */
        _removeRow: function (sPath) {
            var oModel = this._getModel();
            var aRows  = oModel.getProperty("/quarterlyPercentages");
            // Extract index from path
            var iIndex = parseInt(sPath.split("/").pop(), 10);
            aRows.splice(iIndex, 1);
            oModel.setProperty("/quarterlyPercentages", aRows);
            this._addRowIndexes();
            this._markUsedMaterials();
            this._setHasChanges(true);
            this._updateSummaryPendingCount();
        },

        /** Update the pending rows count in summary */
        _updateSummaryPendingCount: function () {
            var oModel  = this._getModel();
            var aRows   = oModel.getProperty("/quarterlyPercentages") || [];
            var iPending = aRows.filter(function (r) { return r.isNew; }).length;
            oModel.setProperty("/summary/pendingRows", iPending);
            oModel.setProperty("/summary/totalMaterials", aRows.length);
        },

        /** Format today's date as "DD Mon YYYY" */
        _getTodayString: function () {
            var d = new Date();
            var months = ["Jan","Feb","Mar","Apr","May","Jun",
                          "Jul","Aug","Sep","Oct","Nov","Dec"];
            return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
        }

    });
});
