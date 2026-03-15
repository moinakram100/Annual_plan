sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/BusyDialog",
    "sap/ui/core/Fragment",
    "sap/ui/core/ValueState",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "com/ingenx/annualplan/utils/HelperFunction"
], function (
    Controller, JSONModel, MessageBox, MessageToast,
    BusyDialog, Fragment, ValueState, Filter, FilterOperator, HelperFunction
) {
    "use strict";

    var MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    var MONTH_MAP = {
        "JAN":"jan","FEB":"feb","MAR":"mar","APR":"apr","MAY":"may","JUN":"jun",
        "JUL":"jul","AUG":"aug","SEP":"sep","OCT":"oct","NOV":"nov","DEC":"dec"
    };

    return Controller.extend("com.ingenx.annualplan.controller.AnnualPlan", {

        onInit: function () {
            var oModel = new JSONModel({
                contractSelection: {
                    customerId    : "",
                    customerName  : "",
                    contractNumber: "",
                    material      : "",
                    materialDesc  : "",
                    calendarYear  : String(new Date().getFullYear())
                },
                contractList    : [],
                selectedContract: null,
                quarterlyLimits : { q1Limit:30, q2Limit:30, q3Limit:30, q4Limit:30 },
                annualPlan: {
                    planId:"", status:"DRAFT",
                    jan:0, feb:0, mar:0, apr:0, may:0, jun:0,
                    jul:0, aug:0, sep:0, oct:0, nov:0, dec:0,
                    q1Total:0, q1Pct:0, q1State:"None", q1Warning:false,
                    q2Total:0, q2Pct:0, q2State:"None", q2Warning:false,
                    q3Total:0, q3Pct:0, q3State:"None", q3Warning:false,
                    q4Total:0, q4Pct:0, q4State:"None", q4Warning:false,
                    annualTotal:0, annualState:"None", aacqMatch:false
                },
                shutdownRows: [],
                myPlans: {
                    loading : false,
                    count   : 0,
                    rows    : []
                },
                ui: {
                    busy            : false,
                    contractSelected: false,
                    hasChanges      : false,
                    submitEnabled   : false,
                    planSubmitted   : false,
                    sdDaysRemaining : 0
                }
            });
            this.getView().setModel(oModel, "ap");
            this._oBusyDialog   = null;
            this._oOriginalPlan = null;
        },

        //  TAB
        onTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            if (sKey === "myPlans") {
                this._loadMyPlans();
            }
        },

        onRefreshMyPlans: function () {
            this._loadMyPlans();
        },

        //  MY PLANS — load from OData
        _loadMyPlans: function () {
            var oModel      = this.getView().getModel("ap");
            var oODataModel = this.getOwnerComponent().getModel();
            var sCustomer   = "1100000003"; // TODO: dynamic from login

            oModel.setProperty("/myPlans/loading", true);
            oModel.setProperty("/myPlans/rows",    []);
            oModel.setProperty("/myPlans/count",   0);

            var oPlanBind = oODataModel.bindList(
                "/xGMSxAP_DATA", null, null,
                [new Filter("Customer", FilterOperator.EQ, sCustomer)],
                { $$groupId: "$auto" }
            );
            var oApprBind = oODataModel.bindList(
                "/xGMSxAP_APPR", null, null, [],
                { $$groupId: "$auto" }
            );
            var oQtBind = oODataModel.bindList(
                "/xGMSxANNUAL_QT", null, null, [],
                { $$groupId: "$auto" }
            );

            Promise.all([
                oPlanBind.requestContexts(0, 5000),
                oApprBind.requestContexts(0, 1000),
                oQtBind.requestContexts(0, 100)
            ])
            .then(function (aResults) {
                var aRawRows  = aResults[0].map(function (c) { return c.getObject(); });
                var aApprRows = aResults[1].map(function (c) { return c.getObject(); });
                var aQtRows   = aResults[2].map(function (c) { return c.getObject(); });

                var oQtByMat = {};
                aQtRows.forEach(function (r) {
                    var sMat = r.Material || "";
                    if (!oQtByMat[sMat]) oQtByMat[sMat] = { q1Limit:0, q2Limit:0, q3Limit:0, q4Limit:0 };
                    var sQ = (r.Subinterval || r.SubInterval || "").toUpperCase();
                    var nV = parseFloat(r.Value || 0);
                    if (sQ === "Q1") oQtByMat[sMat].q1Limit = nV;
                    if (sQ === "Q2") oQtByMat[sMat].q2Limit = nV;
                    if (sQ === "Q3") oQtByMat[sMat].q3Limit = nV;
                    if (sQ === "Q4") oQtByMat[sMat].q4Limit = nV;
                });

                var oApprMap = {};
                aApprRows.forEach(function (r) {
                    if (!oApprMap[r.ContractNo]) oApprMap[r.ContractNo] = [];
                    oApprMap[r.ContractNo].push(r);
                });

                // Group monthly rows by contract
                var oGrouped = {};
                aRawRows.forEach(function (oRow) {
                    var sKey = oRow.ContractNo;
                    if (!oGrouped[sKey]) {
                        oGrouped[sKey] = {
                            contract   : oRow.ContractNo,
                            material   : oRow.Material    || "",
                            customer   : oRow.Customer    || "",
                            salesOffice: oRow.Salesoffice || "",
                            uom        : oRow.Uom         || "MBT",
                            aacq       : parseFloat(oRow.Aacq) || 0,
                            validFrom  : oRow.ValidFrom   || "",
                            validTo    : oRow.ValidTo     || "",
                            jan:0, feb:0, mar:0, apr:0, may:0, jun:0,
                            jul:0, aug:0, sep:0, oct:0, nov:0, dec:0
                        };
                    }
                    var sM = MONTH_MAP[(oRow.SubInterval || "").toUpperCase()];
                    if (sM) oGrouped[sKey][sM] = parseFloat(oRow.Mqvalue) || 0;
                });

                // Build rows with Q totals + approval status
                var aRows = Object.values(oGrouped).map(function (oPlan) {
                    var oLim  = oQtByMat[oPlan.material] || { q1Limit:0, q2Limit:0, q3Limit:0, q4Limit:0 };
                    var aacq  = oPlan.aacq || 1;
                    var q1    = oPlan.jan+oPlan.feb+oPlan.mar;
                    var q2    = oPlan.apr+oPlan.may+oPlan.jun;
                    var q3    = oPlan.jul+oPlan.aug+oPlan.sep;
                    var q4    = oPlan.oct+oPlan.nov+oPlan.dec;
                    var pct   = function (v) { return Math.floor((v/aacq)*100); };
                    var st    = function (p, l) {
                        if (p===0) return "None";
                        if (p>l)   return "Error";
                        if (p===l) return "Success";
                        return "Warning";
                    };

                    oPlan.q1 = q1; oPlan.q1Pct = pct(q1); oPlan.q1State = st(pct(q1), oLim.q1Limit);
                    oPlan.q2 = q2; oPlan.q2Pct = pct(q2); oPlan.q2State = st(pct(q2), oLim.q2Limit);
                    oPlan.q3 = q3; oPlan.q3Pct = pct(q3); oPlan.q3State = st(pct(q3), oLim.q3Limit);
                    oPlan.q4 = q4; oPlan.q4Pct = pct(q4); oPlan.q4State = st(pct(q4), oLim.q4Limit);

                    // Approval status — highest level ka status
                    var aCA = oApprMap[oPlan.contract] || [];
                    var sInd = "";
                    if (aCA.length) {
                        aCA.sort(function (a, b) { return parseInt(b.Arlevel) - parseInt(a.Arlevel); });
                        sInd = aCA[0].Arindicator || "";
                    }
                    oPlan.approvalStatus = sInd === "A" ? "Approved" : sInd === "R" ? "Rejected" : "Pending";
                    oPlan.approvalState  = sInd === "A" ? "Success"  : sInd === "R" ? "Error"    : "Warning";
                    oPlan.submittedOn    = oPlan.validFrom || "";

                    return oPlan;
                });

                oModel.setProperty("/myPlans/rows",    aRows);
                oModel.setProperty("/myPlans/count",   aRows.length);
                oModel.setProperty("/myPlans/loading", false);

            }.bind(this))
            .catch(function (oErr) {
                oModel.setProperty("/myPlans/loading", false);
                MessageBox.error("Failed to load plans: " + (oErr.message || oErr));
            }.bind(this));
        },

        //  VIEW PLAN DETAIL
        onViewMyPlan: function (oEvent) {
            var oRow       = oEvent.getSource().getBindingContext("ap").getObject();
            var oDrillData = jQuery.extend(true, {}, oRow);
            oDrillData.quarterlyLimits = { q1Limit:0, q2Limit:0, q3Limit:0, q4Limit:0 };
            oDrillData.monthlyRow = [{
                jan:oRow.jan, feb:oRow.feb, mar:oRow.mar,
                q1:oRow.q1,   q1State:oRow.q1State,
                apr:oRow.apr, may:oRow.may, jun:oRow.jun,
                q2:oRow.q2,   q2State:oRow.q2State,
                jul:oRow.jul, aug:oRow.aug, sep:oRow.sep,
                q3:oRow.q3,   q3State:oRow.q3State,
                oct:oRow.oct, nov:oRow.nov, dec:oRow.dec,
                q4:oRow.q4,   q4State:oRow.q4State,
                annual: oRow.q1+oRow.q2+oRow.q3+oRow.q4,
                janState:"None",febState:"None",marState:"None",
                aprState:"None",mayState:"None",junState:"None",
                julState:"None",augState:"None",sepState:"None",
                octState:"None",novState:"None",decState:"None"
            }];
            var oDrillModel = new JSONModel(oDrillData);

            if (!this._oMyPlanDrillDialog) {
                Fragment.load({
                    id        : this.getView().getId(),
                    name      : "com.ingenx.annualplan.fragments.CustomerDrillDown",
                    controller: this
                }).then(function (oDialog) {
                    this._oMyPlanDrillDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.setModel(oDrillModel, "drill");
                    oDialog.open();
                }.bind(this));
            } else {
                this._oMyPlanDrillDialog.setModel(oDrillModel, "drill");
                this._oMyPlanDrillDialog.open();
            }
        },

        onCloseDrillDown: function () {
            if (this._oMyPlanDrillDialog) this._oMyPlanDrillDialog.close();
        },

        //  BUSY DIALOG
        _showBusy: function (sMsg) {
            if (!this._oBusyDialog) {
                this._oBusyDialog = new BusyDialog({ title:"Please Wait", text:sMsg||"Loading…" });
            } else {
                this._oBusyDialog.setText(sMsg || "Loading…");
            }
            this._oBusyDialog.open();
        },

        _hideBusy: function () {
            if (this._oBusyDialog) this._oBusyDialog.close();
        },

        //  MATERIAL VALUE HELP
        onMaterialVH: function () {
            if (!this._oMaterialDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "com.ingenx.annualplan.fragments.MaterialValueHelp",
                    controller: this
                }).then(function (oDialog) {
                    this._oMaterialDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                var oBinding = this._oMaterialDialog.getBinding("items");
                if (oBinding) oBinding.filter([]);
                this._oMaterialDialog.open();
            }
        },

        onMaterialVHConfirm: function (oEvent) {
            var oSelected = oEvent.getParameter("selectedItem");
            if (!oSelected) return;
            var oCtx      = oSelected.getBindingContext();
            var oData     = oCtx ? oCtx.getObject() : null;
            var sMaterial = oData ? oData.Material    : oSelected.getTitle();
            var sMatDesc  = oData ? oData.MaterialDesc : oSelected.getDescription();
            var oModel    = this.getView().getModel("ap");
            oModel.setProperty("/contractSelection/material",     sMaterial);
            oModel.setProperty("/contractSelection/materialDesc", sMatDesc);
            oModel.setProperty("/contractSelection/contractNumber", "");
            oModel.setProperty("/contractList",        []);
            oModel.setProperty("/ui/contractSelected", false);
            this._resetPlan();
            this._loadContractsByCustomer("1100000003", sMaterial);
        },

        onMaterialVHSearch: function (oEvent) {
            HelperFunction._valueHelpLiveSearch(oEvent, ["Material","MaterialDesc"]);
        },

        onMaterialVHCancel: function () {},

        //  CONTRACT VALUE HELP
        onContractVH: function () {
            var oModel    = this.getView().getModel("ap");
            var sMaterial = oModel.getProperty("/contractSelection/material") || "";
            var aList     = oModel.getProperty("/contractList") || [];
            if (!sMaterial || aList.length === 0) return;
            var oContractInput = this.byId("inputContractNo");
            if (!this._oContractVHDialog) {
                if (oContractInput) oContractInput.setBusy(true);
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.ingenx.annualplan.fragments.ContractList",
                    controller: this
                }).then(function (oDialog) {
                    this._oContractVHDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    if (oContractInput) oContractInput.setBusy(false);
                    oDialog.open();
                }.bind(this));
            } else {
                this._oContractVHDialog.open();
            }
        },

        onContractVHSearch: function (oEvent) {
            var sValue    = oEvent.getParameter("value") || oEvent.getParameter("newValue") || "";
            var oModel    = this.getView().getModel("ap");
            var aAll      = this._aAllContracts || oModel.getProperty("/contractList") || [];
            if (!this._aAllContracts) this._aAllContracts = aAll.slice();
            var sLower    = sValue.toLowerCase();
            var aFiltered = sValue
                ? aAll.filter(function (c) {
                    return c.ContractNo.toLowerCase().includes(sLower) ||
                           c.Material.toLowerCase().includes(sLower);
                  })
                : aAll;
            oModel.setProperty("/contractList", aFiltered);
        },

        onContractVHConfirm: function (oEvent) {
            var oSelected = oEvent.getParameter("selectedItem");
            if (!oSelected) return;
            var oCtx        = oSelected.getBindingContext("ap");
            var oData       = oCtx.getObject();
            var sContractNo = oData.ContractNo;
            var oInput      = this.byId("inputContractNo");
            if (oInput) oInput.setValue(sContractNo);
            var oModel = this.getView().getModel("ap");
            oModel.setProperty("/contractSelection/contractNumber", sContractNo);
            oModel.setProperty("/ui/contractSelected", false);
        },

        onContractVHCancel: function () {
            if (this._aAllContracts) {
                this.getView().getModel("ap").setProperty("/contractList", this._aAllContracts);
                this._aAllContracts = null;
            }
        },

        onContractChange: function () {
            var oInput = this.byId("inputContractNo");
            var sVal   = oInput ? oInput.getValue() : "";
            if (!sVal) {
                var oModel = this.getView().getModel("ap");
                oModel.setProperty("/contractSelection/contractNumber", "");
                oModel.setProperty("/ui/contractSelected", false);
                this._resetPlan();
            }
        },

        _loadContractsByCustomer: function (sCustomer, sMaterial) {
            var oModel  = this.getView().getModel("ap");
            var oOData  = this.getOwnerComponent().getModel();
            var aFilters = [new Filter("Customer", FilterOperator.EQ, sCustomer)];
            if (sMaterial) aFilters.push(new Filter("Material", FilterOperator.EQ, sMaterial));
            var oBinding = oOData.bindList(
                "/xGMSxAP_CONTRACT", null, null,
                [new Filter({ filters: aFilters, and: true })],
                { $$groupId: "$auto" }
            );
            oBinding.requestContexts(0, Infinity)
                .then(function (aContexts) {
                    var aContracts = aContexts.map(function (oCtx) { return oCtx.getObject(); });
                    oModel.setProperty("/contractList", aContracts);
                    if (aContracts.length) {
                        MessageToast.show(aContracts.length + " contract(s) loaded.");
                    } else {
                        MessageToast.show("No contracts found for selected material.");
                    }
                }.bind(this))
                .catch(function (err) {
                    MessageToast.show("Contracts load failed: " + (err.message || err));
                });
        },

        //  GO BUTTON
        onLoadContract: function () {
            var oModel          = this.getView().getModel("ap");
            var oInput          = this.byId("inputContractNo");
            var sContractNumber = oInput ? oInput.getValue() : oModel.getProperty("/contractSelection/contractNumber");
            if (!sContractNumber) {
                MessageBox.warning("Please select a Contract Number before loading.");
                return;
            }
            this._loadContractData(sContractNumber);
        },

        _loadContractData: async function (sContractNumber) {
            try {
                var oModel      = this.getView().getModel("ap");
                var oODataModel = this.getOwnerComponent().getModel();
                var aList       = oModel.getProperty("/contractList") || [];
                var oRaw        = aList.find(function (c) { return c.ContractNo === sContractNumber; });
                if (!oRaw) { MessageBox.error("Contract '" + sContractNumber + "' not found."); return; }

                var oBindLimits = oODataModel.bindList("/xGMSxANNUAL_QT", null, null,
                    [new Filter("Material", FilterOperator.EQ, oRaw.Material)]);
                var aLimitCtx   = await oBindLimits.requestContexts(0, 100);
                var aLimitData  = aLimitCtx.map(function (c) { return c.getObject(); });

                var oLimits = { q1Limit:0, q2Limit:0, q3Limit:0, q4Limit:0 };
                aLimitData.forEach(function (oItem) {
                    var fVal = parseFloat(oItem.Value) || 0;
                    switch (oItem.Subinterval) {
                        case "Q1": oLimits.q1Limit = fVal; break;
                        case "Q2": oLimits.q2Limit = fVal; break;
                        case "Q3": oLimits.q3Limit = fVal; break;
                        case "Q4": oLimits.q4Limit = fVal; break;
                    }
                });

                var oContract = {
                    contractNumber: oRaw.ContractNo,
                    customerId    : oRaw.Customer,
                    customerDesc  : oRaw.CustomerName,
                    material      : oRaw.Material,
                    salesOffice   : oRaw.SalesOffice,
                    validFrom     : oRaw.ValidFrom,
                    validTo       : oRaw.ValidTo,
                    acq           : parseFloat(oRaw.ACQ) || 0,
                    aacq          : parseFloat(oRaw.ACQ) || 0,
                    uom           : oRaw.Uom || "MBT",
                    topPercent    : parseFloat(oRaw.ThresholdPer) || 0,
                    topLabel      : oRaw.FinancialParamDesc,
                    upwardFlex    : 0,
                    downwardFlex  : 0,
                    makeUpGas     : 0,
                    makeGoodGas   : 0,
                    fmDeficiency  : 0,
                    sdDaysAllowed : 30,
                    sdDaysUsed    : 0,
                    status        : "ACTIVE"
                };

                oModel.setProperty("/selectedContract",    oContract);
                oModel.setProperty("/quarterlyLimits",     oLimits);
                oModel.setProperty("/ui/contractSelected", true);
                oModel.setProperty("/ui/sdDaysRemaining",  oContract.sdDaysAllowed);
                oModel.setProperty("/ui/planSubmitted",    false);
                oModel.setProperty("/ui/hasChanges",       false);
                oModel.setProperty("/ui/submitEnabled",    false);
                this._resetPlan();
                this._oOriginalPlan = jQuery.extend(true, {}, oModel.getProperty("/annualPlan"));

                MessageToast.show("Contract loaded: " + oContract.contractNumber + " · " + oContract.material);

            } catch (oErr) {
                MessageBox.error("Failed to load contract data: " + oErr.message);
            } finally {
                this._hideBusy();
            }
        },

        //  MONTHLY CHANGE
        onMonthChange: function () {
            var oModel    = this.getView().getModel("ap");
            var oPlan     = oModel.getProperty("/annualPlan");
            var oContract = oModel.getProperty("/selectedContract");
            var oLimits   = oModel.getProperty("/quarterlyLimits");
            if (!oContract) return;
            var acq = oContract.acq;
            var q1 = (oPlan.jan||0)+(oPlan.feb||0)+(oPlan.mar||0);
            var q2 = (oPlan.apr||0)+(oPlan.may||0)+(oPlan.jun||0);
            var q3 = (oPlan.jul||0)+(oPlan.aug||0)+(oPlan.sep||0);
            var q4 = (oPlan.oct||0)+(oPlan.nov||0)+(oPlan.dec||0);
            var annual = q1+q2+q3+q4;
            var pct = function (v) { return acq ? parseFloat(((v/acq)*100).toFixed(1)) : 0; };
            var q1Pct = pct(q1), q2Pct = pct(q2), q3Pct = pct(q3), q4Pct = pct(q4);
            var q1State = this._getQtrState(q1Pct, oLimits.q1Limit);
            var q2State = this._getQtrState(q2Pct, oLimits.q2Limit);
            var q3State = this._getQtrState(q3Pct, oLimits.q3Limit);
            var q4State = this._getQtrState(q4Pct, oLimits.q4Limit);
            var bAACQMatch   = acq > 0 ? (annual === acq) : false;
            var sAnnualState = bAACQMatch ? "Success" : (annual > 0 ? "Error" : "None");

            oModel.setProperty("/annualPlan/q1Total",    q1);
            oModel.setProperty("/annualPlan/q1Pct",      q1Pct);
            oModel.setProperty("/annualPlan/q1State",    q1State);
            oModel.setProperty("/annualPlan/q1Warning",  q1State === "Error" || q1State === "Warning");
            oModel.setProperty("/annualPlan/q2Total",    q2);
            oModel.setProperty("/annualPlan/q2Pct",      q2Pct);
            oModel.setProperty("/annualPlan/q2State",    q2State);
            oModel.setProperty("/annualPlan/q2Warning",  q2State === "Error" || q2State === "Warning");
            oModel.setProperty("/annualPlan/q3Total",    q3);
            oModel.setProperty("/annualPlan/q3Pct",      q3Pct);
            oModel.setProperty("/annualPlan/q3State",    q3State);
            oModel.setProperty("/annualPlan/q3Warning",  q3State === "Error" || q3State === "Warning");
            oModel.setProperty("/annualPlan/q4Total",    q4);
            oModel.setProperty("/annualPlan/q4Pct",      q4Pct);
            oModel.setProperty("/annualPlan/q4State",    q4State);
            oModel.setProperty("/annualPlan/q4Warning",  q4State === "Error" || q4State === "Warning");
            oModel.setProperty("/annualPlan/annualTotal", annual);
            oModel.setProperty("/annualPlan/annualState", sAnnualState);
            oModel.setProperty("/annualPlan/aacqMatch",   bAACQMatch);
            oModel.setProperty("/ui/submitEnabled", bAACQMatch);
            oModel.setProperty("/ui/hasChanges",    annual > 0);
        },

        //  ADD SHUTDOWN ROWS
        onAddShutdownRow: function () {
            var oModel     = this.getView().getModel("ap");
            var iRemaining = oModel.getProperty("/ui/sdDaysRemaining");
            if (iRemaining <= 0) { MessageBox.warning("All shutdown days have been allocated."); return; }
            var aRows = oModel.getProperty("/shutdownRows") || [];
            aRows.push({ id:"SD-"+Date.now(), startDate:null, endDate:null, days:0, dcq:0, reason:"", daysState:ValueState.None });
            oModel.setProperty("/shutdownRows", aRows);
            oModel.setProperty("/ui/hasChanges", true);
            this._recalcSDRemaining();
        },

        onShutdownChange: function (oEvent) {
            var oSource = oEvent && oEvent.getSource ? oEvent.getSource() : null;
            if (oSource && oSource.getMetadata().getName() === "sap.m.DateRangeSelection") {
                var oCtx   = oSource.getBindingContext("ap");
                var sPath  = oCtx ? oCtx.getPath() : null;
                var oModel = this.getView().getModel("ap");
                if (sPath) {
                    var oStart = oSource.getDateValue();
                    var oEnd   = oSource.getSecondDateValue();
                    if (oStart && oEnd) {
                        var iDays = Math.round((oEnd.getTime()-oStart.getTime())/(1000*60*60*24)) + 1;
                        oModel.setProperty(sPath+"/startDate", oStart);
                        oModel.setProperty(sPath+"/endDate",   oEnd);
                        oModel.setProperty(sPath+"/days",      iDays);
                    } else {
                        oModel.setProperty(sPath+"/startDate", null);
                        oModel.setProperty(sPath+"/endDate",   null);
                        oModel.setProperty(sPath+"/days",      0);
                    }
                }
            }
            this._recalcSDRemaining();
            this.getView().getModel("ap").setProperty("/ui/hasChanges", true);
        },

        onDeleteShutdownRow: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("ap");
            var iIndex   = parseInt(oContext.getPath().split("/").pop(), 10);
            var oModel   = this.getView().getModel("ap");
            var aRows    = oModel.getProperty("/shutdownRows");
            aRows.splice(iIndex, 1);
            oModel.setProperty("/shutdownRows", aRows);
            this._recalcSDRemaining();
            oModel.setProperty("/ui/hasChanges", true);
        },

        _recalcSDRemaining: function () {
            var oModel     = this.getView().getModel("ap");
            var aRows      = oModel.getProperty("/shutdownRows") || [];
            var iAllowed   = oModel.getProperty("/selectedContract/sdDaysAllowed") || 0;
            var iTotalUsed = aRows.reduce(function (s, r) { return s+(parseInt(r.days)||0); }, 0);
            oModel.setProperty("/ui/sdDaysRemaining", Math.max(iAllowed-iTotalUsed, 0));
            aRows.forEach(function (r, i) {
                oModel.setProperty("/shutdownRows/"+i+"/daysState",
                    iTotalUsed>iAllowed ? ValueState.Error : ValueState.None);
            });
        },

        //  SUBMIT PLAN — existing plan check + confirm
        onSubmitPlan: function () {
            var oModel    = this.getView().getModel("ap");
            var oContract = oModel.getProperty("/selectedContract");
            var oPlan     = oModel.getProperty("/annualPlan");
            var aSD       = oModel.getProperty("/shutdownRows") || [];

            var aErrors = this._validateBeforeSubmit(oContract, oPlan, aSD);
            if (aErrors.length > 0) {
                MessageBox.error(
                    "Please fix the following:\n\n" +
                    aErrors.map(function (e, i) { return (i+1)+". "+e; }).join("\n"),
                    { title: "Validation Failed" }
                );
                return;
            }

            // Check existing plan 
            var oODataModel = this.getOwnerComponent().getModel();
            var oBinding    = oODataModel.bindList(
                "/xGMSxAP_DATA", null, null,
                [new Filter("ContractNo", FilterOperator.EQ, oContract.contractNumber)],
                { $$groupId: "$auto" }
            );

            oModel.setProperty("/ui/busy", true);

            oBinding.requestContexts(0, 1)
                .then(function (aCtx) {
                    oModel.setProperty("/ui/busy", false);

            if (aCtx && aCtx.length > 0) {
                var oExisting    = aCtx[0].getObject();
                var sStatus      = oExisting.Status || "";
                var sStatusLabel = sStatus === "A" ? "Approved"
                                 : sStatus === "P" ? "Pending Approval"
                                 : sStatus === "R" ? "Rejected"
                                 : "Submitted";

                // ── Rejected → allow re-submit  ──────────
                if (sStatus === "R") {
                    this._confirmAndSubmit(oContract, oPlan, aSD,
                        "Previous plan was Rejected.\n" +
                        "You can re-submit a new plan.\n\n" +
                        "Contract : " + oContract.contractNumber + "\n" +
                        "Customer : " + oContract.customerDesc   + "\n" +
                        "AACQ     : " + oContract.aacq + " " + oContract.uom
                    );
                    return;
                }

                // Pending / Approved → BLOCK 
                MessageBox.error(
                    "Submission not allowed for this contract.\n\n" +
                    "Contract : " + oContract.contractNumber + "\n" +
                    "Status   : " + sStatusLabel + "\n\n" +
                    (sStatus === "A"
                        ? "This plan has already been Approved.\n" +
                          "No further changes are allowed.\n" +
                          "Contact your Zonal Office for modifications."
                        : "This plan is currently Pending Approval.\n" +
                          "Please wait for the approval process to complete.\n" +
                          "If changes are needed, ask your Zonal Officer to reject it first."
                    ),
                    {
                        title  : "Submission Not Allowed",
                        icon   : MessageBox.Icon.ERROR,
                        actions: [MessageBox.Action.OK]
                    }
                );

            } else {
                this._confirmAndSubmit(oContract, oPlan, aSD,
                    "Submit Annual Plan for:\n\n" +
                    "Contract : " + oContract.contractNumber + "\n" +
                    "Customer : " + oContract.customerDesc   + "\n" +
                    "Material : " + oContract.material       + "\n" +
                    "AACQ     : " + oContract.aacq + " " + oContract.uom + "\n\n" +
                    "Plan will be sent to Zonal Office for approval."
                );
            }

        }.bind(this))
        .catch(function () {
            oModel.setProperty("/ui/busy", false);
            this._confirmAndSubmit(oContract, oPlan, aSD,
                "Submit plan for contract: " + oContract.contractNumber
            );
        }.bind(this));
},

        _confirmAndSubmit: function (oContract, oPlan, aSD, sBaseMsg) {
            var oModel  = this.getView().getModel("ap");
            var oLimits = oModel.getProperty("/quarterlyLimits");
            var aWarn   = [];
            if (oPlan.q1Pct > oLimits.q1Limit) aWarn.push("Q1 ("+oPlan.q1Pct+"%) exceeds "+oLimits.q1Limit+"%");
            if (oPlan.q2Pct > oLimits.q2Limit) aWarn.push("Q2 ("+oPlan.q2Pct+"%) exceeds "+oLimits.q2Limit+"%");
            if (oPlan.q3Pct > oLimits.q3Limit) aWarn.push("Q3 ("+oPlan.q3Pct+"%) exceeds "+oLimits.q3Limit+"%");
            if (oPlan.q4Pct > oLimits.q4Limit) aWarn.push("Q4 ("+oPlan.q4Pct+"%) exceeds "+oLimits.q4Limit+"%");
            var sMsg = sBaseMsg +
                (aWarn.length ? "\n\n⚠ Quarterly warnings:\n" + aWarn.map(function(w){return "  • "+w;}).join("\n") : "") +
                "\n\nProceed?";
            MessageBox.confirm(sMsg, {
                title           : "Confirm Submission",
                icon            : aWarn.length ? MessageBox.Icon.WARNING : MessageBox.Icon.SUCCESS,
                actions         : [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) this._persistSubmit();
                }.bind(this)
            });
        },

        _persistSubmit: function () {
            var oModel      = this.getView().getModel("ap");
            var oContract   = oModel.getProperty("/selectedContract");
            var oPlan       = oModel.getProperty("/annualPlan");
            var aSD         = oModel.getProperty("/shutdownRows") || [];
            var sYear       = oModel.getProperty("/contractSelection/calendarYear");
            var sValidFrom  = oContract.validFrom;
            var sValidTo    = oContract.validTo;

            this._showBusy("Submitting plan…");

            var fnDateStr = function (oDate) {
                if (!oDate) return null;
                var oD = (oDate instanceof Date) ? oDate : new Date(oDate);
                return oD.getFullYear()+"-"+String(oD.getMonth()+1).padStart(2,"0")+"-"+String(oD.getDate()).padStart(2,"0");
            };

            var aMonthNames = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
            var oSdByMonth  = {};
            aSD.forEach(function (oSD) {
                if (!oSD.startDate) return;
                var oStart   = (oSD.startDate instanceof Date) ? oSD.startDate : new Date(oSD.startDate);
                var sSDMonth = aMonthNames[oStart.getMonth()];
                if (!oSdByMonth[sSDMonth]) oSdByMonth[sSDMonth] = oSD;
            });

            var aMonthMap = [
                { months:["JAN","FEB","MAR"], keys:["jan","feb","mar"] },
                { months:["APR","MAY","JUN"], keys:["apr","may","jun"] },
                { months:["JUL","AUG","SEP"], keys:["jul","aug","sep"] },
                { months:["OCT","NOV","DEC"], keys:["oct","nov","dec"] }
            ];

            var aRows = [];
            aMonthMap.forEach(function (oQtr) {
                oQtr.months.forEach(function (sMonth, idx) {
                    var fMqvalue = parseFloat(oPlan[oQtr.keys[idx]]) || 0;
                    var oSD      = oSdByMonth[sMonth] || {};
                    var bHasSD   = !!oSD.startDate;
                    var oRow = {
                        Period       : "M",
                        Calendaryear : sYear,
                        Aacq         : oContract.acq,
                        Material     : oContract.material,
                        SubInterval  : sMonth,
                        Customer     : oContract.customerId,
                        ContractNo   : oContract.contractNumber,
                        ValidFrom    : sValidFrom,
                        ValidTo      : sValidTo,
                        Acq          : oContract.acq,
                        Uom          : "MBT",
                        Mqvalue      : fMqvalue,
                        Status       : "A",
                        UpwardFlexper: oContract.upwardFlex   || 0,
                        DnwardFlexper: oContract.downwardFlex || 0,
                        Fmdeficiency : oContract.fmDeficiency || 0,
                        Makegood     : oContract.makeGoodGas  || 0,
                        Makeup       : oContract.makeUpGas    || 0,
                        Toppercentage: oContract.topPercent   || 0,
                        Salesoffice  : oContract.salesOffice  || ""
                    };
                    if (bHasSD) {
                        oRow.SdstartDate = fnDateStr(oSD.startDate);
                        oRow.SdendDate   = fnDateStr(oSD.endDate);
                        oRow.Sddays      = String(oSD.days || 0);
                        oRow.Sdvalue     = parseFloat(oSD.dcq) || 0;
                        oRow.Sdreason    = oSD.reason || "";
                    }
                    aRows.push(oRow);
                });
            });

            var oPayload = {
                Material    : oContract.material,
                Customer    : oContract.customerId,
                ContractNo  : oContract.contractNumber,
                ValidFrom   : sValidFrom,
                ValidTo     : sValidTo,
                to_annualpln: aRows
            };

            var oODataModel = this.getOwnerComponent().getModel();
            var oBindList   = oODataModel.bindList("/CreateAnnualplanSet");
            var oContext    = oBindList.create(oPayload, true);

            oContext.created()
                .then(function () {
                    this._hideBusy();
                    oModel.setProperty("/ui/planSubmitted",  true);
                    oModel.setProperty("/ui/hasChanges",     false);
                    oModel.setProperty("/ui/submitEnabled",  false);
                    oModel.setProperty("/annualPlan/status", "SUBMITTED");
                    MessageToast.show("Plan submitted to Zonal Office.");
                    this._loadMyPlans();
                }.bind(this))
                .catch(function (oErr) {
                    this._hideBusy();
                    var sMsg = "Submit failed.";
                    try {
                        if (oErr && oErr.cause && oErr.cause.message) sMsg = oErr.cause.message;
                        else if (oErr && oErr.message) sMsg = oErr.message;
                    } catch (e) {}
                    MessageBox.error(sMsg, { title: "Submission Failed" });
                    try { oContext.delete(); } catch (e) {}
                }.bind(this));
        },

        //  RESET / CLEAR
        onReset: function () {
            MessageBox.confirm("Reset all monthly quantities to zero?", {
                title: "Reset Plan",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._resetPlan();
                        var oModel = this.getView().getModel("ap");
                        oModel.setProperty("/shutdownRows", []);
                        this._recalcSDRemaining();
                        MessageToast.show("Plan reset.");
                    }
                }.bind(this)
            });
        },

        onClearAll: function () {
            var oModel = this.getView().getModel("ap");
            if (oModel.getProperty("/ui/hasChanges")) {
                MessageBox.confirm("Clear all entries?", {
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) this._fullReset();
                    }.bind(this)
                });
            } else {
                this._fullReset();
            }
        },

        onSelectionChange: function () {},

        //  HELPER CODE
        _getQtrState: function (pct, limit) {
            if (pct === 0)   return "None";
            if (pct > limit) return "Warning";
            if (pct === limit) return "Success";
            return "Warning";
        },

        _validateBeforeSubmit: function (oContract, oPlan, aSD) {
            var aErrors = [];
            var aZero   = [];
            MONTHS.forEach(function (m) {
                if (!(oPlan[m] > 0)) aZero.push(m.charAt(0).toUpperCase()+m.slice(1));
            });
            if (aZero.length > 0) aErrors.push("Monthly quantities must be > 0 for: " + aZero.join(", "));
            if (oPlan.annualTotal !== oContract.acq) {
                aErrors.push("Annual total ("+oPlan.annualTotal+") must equal ACQ ("+oContract.acq+" "+oContract.uom+").");
            }
            var iAllowed = oContract.sdDaysAllowed;
            var iUsed    = aSD.reduce(function (s, r) { return s+(parseInt(r.days)||0); }, 0);
            if (iUsed > iAllowed) aErrors.push("Shutdown days ("+iUsed+") exceed allowance ("+iAllowed+" days).");
            aSD.forEach(function (r, i) {
                if (r.days > 0 && !(r.dcq > 0)) aErrors.push("Shutdown row "+(i+1)+": DCQ must be > 0.");
            });
            return aErrors;
        },

        _resetPlan: function () {
            var oModel = this.getView().getModel("ap");
            oModel.setProperty("/annualPlan", {
                planId:"", status:"DRAFT",
                jan:0, feb:0, mar:0, apr:0, may:0, jun:0,
                jul:0, aug:0, sep:0, oct:0, nov:0, dec:0,
                q1Total:0, q1Pct:0, q1State:"None", q1Warning:false,
                q2Total:0, q2Pct:0, q2State:"None", q2Warning:false,
                q3Total:0, q3Pct:0, q3State:"None", q3Warning:false,
                q4Total:0, q4Pct:0, q4State:"None", q4Warning:false,
                annualTotal:0, annualState:"None", aacqMatch:false
            });
            oModel.setProperty("/ui/hasChanges",    false);
            oModel.setProperty("/ui/submitEnabled", false);
            oModel.setProperty("/ui/planSubmitted", false);
        },

        _fullReset: function () {
            var oModel = this.getView().getModel("ap");
            oModel.setProperty("/contractSelection/contractNumber", "");
            oModel.setProperty("/contractSelection/customerId",     "");
            oModel.setProperty("/contractSelection/customerName",   "");
            oModel.setProperty("/selectedContract",   null);
            oModel.setProperty("/contractList",       []);
            oModel.setProperty("/ui/contractSelected",false);
            oModel.setProperty("/shutdownRows",       []);
            this._resetPlan();
            MessageToast.show("Cleared.");
        }

    });
});