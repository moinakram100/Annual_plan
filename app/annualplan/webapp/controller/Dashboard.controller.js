sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "com/ingenx/annualplan/utils/HelperFunction"
], function (Controller, JSONModel, Filter, FilterOperator, Sorter, MessageBox, MessageToast, Fragment, HelperFunction) {
    "use strict";

    var SUBINTERVAL_MAP = {
        "JAN":"jan","FEB":"feb","MAR":"mar",
        "APR":"apr","MAY":"may","JUN":"jun",
        "JUL":"jul","AUG":"aug","SEP":"sep",
        "OCT":"oct","NOV":"nov","DEC":"dec"
    };

    return Controller.extend("com.ingenx.annualplan.controller.Dashboard", {
        onInit: function () {
            var oModel = new JSONModel({
                user: {
                    sapUser      : "",
                    level      : 0,
                    salesOffice: "",
                    isLoading  : true,
                    isValid    : false
                },
                filters         : { salesOffice:"", material:"", customer:"", customerName:"", contractNo:"" },
                planRows        : [],
                filteredRows    : [],
                kpiSummary      : {},
                quarterlyLimits : { q1Limit:0, q2Limit:0, q3Limit:0, q4Limit:0 },
                dashContractList: [],
                approvalData    : [],
                ui: {
                    dataLoaded    : false,
                    busy          : false,
                    lastRefreshed : "",
                    accessDenied  : false,
                    accessDeniedMsg: ""
                }
            });
            this.getView().setModel(oModel, "dash");
            this._oLegendDialog = null;
            this._oDrillDialog  = null;
            this._oEditDialog   = null;

            this._initUserSession();
        },

        //  USER SESSION — hardcoded for testing
        //  TODO: Replace _getMockUser() with real API call when ready
        _initUserSession: function () {
            var oModel = this.getView().getModel("dash");

            // ── Get logged-in user email ──────────────────────────────
            var sEmail = "";
            var sUser = "";
            try {
                sUser = sap.ushell.Container.getService("UserInfo").getId() || "";
            } catch (e) {
                sUser = "userD";  
            }
            oModel.setProperty("/user/sapUser", sUser);
            //  Validate user from mock store (replace with API later)
            var oUserRecord = this._getMockUser(sUser);
            oModel.setProperty("/user/isLoading", false);
            if (!oUserRecord) {
                oModel.setProperty("/user/isValid",        false);
                oModel.setProperty("/ui/accessDenied",     true);
                oModel.setProperty("/ui/accessDeniedMsg",
                    "User '" + sUser + "' is not authorized. Please contact your administrator.");
                return;
            }
            oModel.setProperty("/user/level",       parseInt(oUserRecord.APLevel) || 1);
            oModel.setProperty("/user/salesOffice", oUserRecord.SalesOffice       || "");
            oModel.setProperty("/user/isValid",     true);
            sap.m.MessageToast.show("Logged in as Level " + oUserRecord.APLevel + " — " + sUser);
            this._loadApprovalData();
        },

//  MOCK USER STORE — replace this function with API call later
//  TODO when API (ApprovalUsers) is ready:
//  Replace entire _getMockUser() with:

//  _fetchUserLevel: function(sEmail) {
//      var oBinding = oODataModel.bindList("/ApprovalUsers", null, null,
//          [new Filter("suser", FilterOperator.EQ, sEmail)]);
//      oBinding.requestContexts(0,1).then(function(aCtx) {
//          if (!aCtx.length) { // access denied }
//          var o = aCtx[0].getObject();
//          oModel.setProperty("/user/level", parseInt(o.apLevel));
//          oModel.setProperty("/user/salesOffice", o.salesOffice);
//          oModel.setProperty("/user/isValid", true);
//      });
//  }
// ════════════════════════════════════════════════════════════════


        _getMockUser: function (sUser) {
            var aMockUsers = [
                { Suser: "userA",      SalesOffice: "IN1", APLevel: 1, ChangeAllow: true  },
                { Suser: "Vanshaj",      SalesOffice: "IN1", APLevel: 2, ChangeAllow: true  },
                { Suser: "Shruti",      SalesOffice: "IN1", APLevel: 3, ChangeAllow: false },
                { Suser: "userD",      SalesOffice: "IN1", APLevel: 4, ChangeAllow: false },
                { Suser: "mohin khan", SalesOffice: "IN1", APLevel: 1, ChangeAllow: true  },
                { Suser: "uA@test.com",SalesOffice: "IN1", APLevel: 1, ChangeAllow: true  }
            ];

            var sLower = (sUser || "").toLowerCase();
            return aMockUsers.find(function (u) {
                return (u.Suser || "").toLowerCase() === sLower;
            }) || null;
        },

        _loadApprovalData: function () {
            var oOData = this.getOwnerComponent().getModel();
            var oBinding = oOData.bindList("/xGMSxAP_APPR");
            oBinding.requestContexts(0, 1000).then(function (aContexts) {
            var aData = aContexts.map(function (oCtx) {
                    return oCtx.getObject();
                });

                this.getView().getModel("dash").setProperty("/approvalData", aData);

            }.bind(this));
         },

        //  MATERIAL VALUE HELP
        onMaterialVH: function () {
            if (!this._oMaterialDialog) {
                sap.ui.core.Fragment.load({
                    id        : this.getView().getId(),
                    name      : "com.ingenx.annualplan.fragments.MaterialValueHelp",
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

        onMaterialVHSearch: function (oEvent) {
            HelperFunction._valueHelpLiveSearch(oEvent, ["Material", "MaterialDesc"]);
        },

        onMaterialVHConfirm: function (oEvent) {
            var oSelected = oEvent.getParameter("selectedItem");
            if (!oSelected) return;

            var oCtx      = oSelected.getBindingContext();
            var oData     = oCtx ? oCtx.getObject() : null;
            var sMaterial = oData ? oData.Material : oSelected.getTitle();

            var oModel = this.getView().getModel("dash");
            oModel.setProperty("/filters/material", sMaterial);

            var oInput = this.byId("dashMaterial");
            if (oInput) oInput.setValue(sMaterial);

            oModel.setProperty("/filters/contractNo", "");
            oModel.setProperty("/dashContractList",   []);
            var oContractInput = this.byId("dashContractNo");
            if (oContractInput) oContractInput.setValue("");

            var sCustomer = oModel.getProperty("/filters/customer") || "";
            if (sCustomer) {
                this._dashLoadContracts(sCustomer, sMaterial);
            }
        },

        onMaterialVHCancel: function () {},

        //  CUSTOMER VALUE HELP
        onCustomerVH: function () {
            if (!this._oCustomerVHDialog) {
                Fragment.load({
                    id        : this.getView().getId(),
                    name      : "com.ingenx.annualplan.fragments.CustomerId",
                    controller: this
                }).then(function (oDialog) {
                    this._oCustomerVHDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this._oCustomerVHDialog.open();
            }
        },

        onCustomerVHSearch: function (oEvent) {
            var sVal    = oEvent.getParameter("value") || oEvent.getParameter("newValue") || "";
            var oFilter = new Filter({
                filters: [
                    new Filter("Customer",     FilterOperator.Contains, sVal),
                    new Filter("CustomerName", FilterOperator.Contains, sVal)
                ],
                and: false
            });
            oEvent.getSource().getBinding("items").filter([oFilter]);
        },

        onCustomerVHConfirm: function (oEvent) {
            var oSelected = oEvent.getParameter("selectedItem");
            if (!oSelected) return;

            var oCtx      = oSelected.getBindingContext();
            var oData     = oCtx ? oCtx.getObject() : null;
            var sCustomer = oData ? oData.Customer     : oSelected.getTitle();
            var sName     = oData ? oData.CustomerName : oSelected.getDescription();

            var oModel = this.getView().getModel("dash");
            oModel.setProperty("/filters/customer",     sCustomer);
            oModel.setProperty("/filters/customerName", sName);

            var oInput = this.byId("inputCustomerId");
            if (oInput) oInput.setValue(sCustomer + (sName ? " — " + sName : ""));

            oModel.setProperty("/filters/contractNo", "");
            oModel.setProperty("/dashContractList",   []);
            var oContractInput = this.byId("dashContractNo");
            if (oContractInput) oContractInput.setValue("");

            var sMaterial = oModel.getProperty("/filters/material") || "";
            this._dashLoadContracts(sCustomer, sMaterial);
        },

        onCustomerVHCancel: function () {},

        //  CONTRACTS LOAD — customer + optional material filter
        _dashLoadContracts: function (sCustomer, sMaterial) {
            var oModel      = this.getView().getModel("dash");
            var oODataModel = this.getOwnerComponent().getModel();

            var oContractInput = this.byId("dashContractNo");
            if (oContractInput) oContractInput.setBusy(true);

            var aFilters = [
                new Filter("Customer", FilterOperator.EQ, sCustomer)
            ];
            if (sMaterial) {
                aFilters.push(new Filter("Material", FilterOperator.EQ, sMaterial));
            }

            var oBinding = oODataModel.bindList(
                "/xGMSxAP_CONTRACT", null, null,
                [new Filter({ filters: aFilters, and: true })],
                { $$groupId: "$auto" }
            );

            oBinding.requestContexts(0, 1000)
                .then(function (aContexts) {
                    var aContracts = aContexts.map(function (oCtx) {
                        var o = oCtx.getObject();
                        return {
                            ContractNo  : o.ContractNo   || o.Contract || "",
                            Material    : o.Material     || "",
                            Customer    : o.Customer     || "",
                            CustomerName: o.CustomerName || "",
                            SalesOffice : o.Salesoffice  || o.SalesOffice || ""
                        };
                    });

                    oModel.setProperty("/dashContractList", aContracts);
                    if (oContractInput) oContractInput.setBusy(false);

                    if (!aContracts.length) {
                        MessageToast.show("No contracts found.");
                    } else {
                        MessageToast.show(aContracts.length + " contract(s) loaded.");
                    }
                }.bind(this))
                .catch(function (oErr) {
                    if (oContractInput) oContractInput.setBusy(false);
                    MessageToast.show("Contract load failed: " + (oErr.message || oErr));
                }.bind(this));
        },

        //  CONTRACT VALUE HELP
        onContractVH: function () {
            var oModel    = this.getView().getModel("dash");
            var sCustomer = oModel.getProperty("/filters/customer") || "";
            var aList     = oModel.getProperty("/dashContractList") || [];

            if (!sCustomer) {
                MessageToast.show("Please select a Customer first.");
                return;
            }
            if (!aList.length) {
                MessageToast.show("Contracts loading, please try again.");
                return;
            }

            if (!this._oDashContractDialog) {
                Fragment.load({
                    id        : this.getView().getId(),
                    name      : "com.ingenx.annualplan.fragments.DashContractVH",
                    controller: this
                }).then(function (oDialog) {
                    this._oDashContractDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this._oDashContractDialog.open();
            }
        },

        onDashContractVHSearch: function (oEvent) {
            var sVal      = (oEvent.getParameter("value") || "").toLowerCase();
            var oModel    = this.getView().getModel("dash");
            var aAll      = oModel.getProperty("/dashContractList") || [];
            var aFiltered = sVal
                ? aAll.filter(function (c) {
                    return (c.ContractNo || "").toLowerCase().includes(sVal) ||
                           (c.Material   || "").toLowerCase().includes(sVal);
                  })
                : aAll;
            oModel.setProperty("/dashContractList", aFiltered);
        },

        onDashContractVHConfirm: function (oEvent) {
            var oSelected = oEvent.getParameter("selectedItem");
            if (!oSelected) return;

            var oCtx  = oSelected.getBindingContext("dash");
            var oData = oCtx ? oCtx.getObject() : null;
            if (!oData) return;

            var oModel = this.getView().getModel("dash");
            oModel.setProperty("/filters/contractNo", oData.ContractNo);

            var oInput = this.byId("dashContractNo");
            if (oInput) oInput.setValue(oData.ContractNo);

            if (!oModel.getProperty("/filters/material") && oData.Material) {
                oModel.setProperty("/filters/material", oData.Material);
                var oMatInput = this.byId("dashMaterial");
                if (oMatInput) oMatInput.setValue(oData.Material);
            }
        },

      

        onContractChange: function () {
            var oInput = this.byId("dashContractNo");
            var sVal   = oInput ? oInput.getValue() : "";
            if (!sVal) {
                this.getView().getModel("dash").setProperty("/filters/contractNo", "");
            }
        },

        //  Any combination works: salesOffice only | material only | customer only | contractNo only
        onApplyFilter: function () {
            var oModel   = this.getView().getModel("dash");
            var oFilters = oModel.getProperty("/filters");
            oModel.setProperty("/ui/busy", true);

            var oODataModel  = this.getOwnerComponent().getModel();
            var aODataFilters = [];

            if (oFilters.salesOffice) {
                aODataFilters.push(new Filter("Salesoffice", FilterOperator.EQ, oFilters.salesOffice));
            }
            if (oFilters.material) {
                aODataFilters.push(new Filter("Material", FilterOperator.EQ, oFilters.material));
            }
            if (oFilters.customer) {
                aODataFilters.push(new Filter("Customer", FilterOperator.EQ, oFilters.customer));
            }
            if (oFilters.contractNo) {
                aODataFilters.push(new Filter("ContractNo", FilterOperator.EQ, oFilters.contractNo));
            }

            var oCombinedFilter = aODataFilters.length
                ? new Filter({ filters: aODataFilters, and: true }) : null;

            var oPlanBind = oODataModel.bindList(
                "/xGMSxAP_DATA", null, null,
                oCombinedFilter ? [oCombinedFilter] : [],
                { $$groupId: "$auto" }
            );
            var oQtBind = oODataModel.bindList(
                "/xGMSxANNUAL_QT", null, null, [],
                { $$groupId: "$auto" }
            );

            Promise.all([
                oPlanBind.requestContexts(0, 5000),
                oQtBind.requestContexts(0, 100)
            ])
            .then(function (aResults) {
                var aRawRows = aResults[0].map(function (c) { return c.getObject(); });
                var aQtRows  = aResults[1].map(function (c) { return c.getObject(); });
                this._processODataRows(aRawRows, aQtRows);
            }.bind(this))
            .catch(function (oErr) {
                oModel.setProperty("/ui/busy", false);
                MessageBox.error("Failed to load data: " + (oErr.message || oErr));
            }.bind(this));
        },

        //  LOAD DATA INTO TABLE WITH LOGICS AND CALC
       _processODataRows: function (aRawRows, aQtRows) {
            var oModel = this.getView().getModel("dash");

            var oQtByMaterial = {};
            aQtRows.forEach(function (r) {
                var sMat = r.Material || "";
                if (!oQtByMaterial[sMat]) {
                    oQtByMaterial[sMat] = { q1Limit:0, q2Limit:0, q3Limit:0, q4Limit:0 };
                }
                var sQtr = (r.Subinterval || r.SubInterval || "").toUpperCase();
                var nVal = parseFloat(r.Value || 0);
                if (sQtr === "Q1") oQtByMaterial[sMat].q1Limit = nVal;
                if (sQtr === "Q2") oQtByMaterial[sMat].q2Limit = nVal;
                if (sQtr === "Q3") oQtByMaterial[sMat].q3Limit = nVal;
                if (sQtr === "Q4") oQtByMaterial[sMat].q4Limit = nVal;
            });

            var aApproval    = oModel.getProperty("/approvalData") || [];
            var iUserLevel   = oModel.getProperty("/user/level")   || 1;

            var oApprovalByLevel = {};
            aApproval.forEach(function (r) {
                var sKey = r.ContractNo + "|" + String(r.Arlevel);
                oApprovalByLevel[sKey] = r.Arindicator;
            });

            var oGrouped = {};
            aRawRows.forEach(function (oRow) {
                var sKey = oRow.ContractNo + "|" + oRow.Customer + "|" + oRow.Material;
                if (!oGrouped[sKey]) {
                    oGrouped[sKey] = {
                        planId      : oRow.ContractNo,
                        contract    : oRow.ContractNo,
                        customerId  : oRow.Customer,
                        customer    : oRow.Customer,
                        material    : oRow.Material,
                        salesOffice : oRow.Salesoffice || "",
                        uom         : oRow.Uom        || "MBT",
                        aacq        : parseFloat(oRow.Aacq) || 0,
                        acq         : parseFloat(oRow.Acq)  || 0,
                        status      : oRow.Status    || "",
                        validFrom   : oRow.ValidFrom || "",
                        validTo     : oRow.ValidTo   || "",
                        jan:0, feb:0, mar:0, apr:0, may:0, jun:0,
                        jul:0, aug:0, sep:0, oct:0, nov:0, dec:0
                    };
                }
                var sMonth = SUBINTERVAL_MAP[(oRow.SubInterval || "").toUpperCase()];
                if (sMonth) {
                    oGrouped[sKey][sMonth] = parseFloat(oRow.Mqvalue) || 0;
                }
            });

            var oDefaultLimits = { q1Limit:0, q2Limit:0, q3Limit:0, q4Limit:0 };

            var aPlanRows = Object.values(oGrouped).map(function (oPlan) {

                var oMatLimits = oQtByMaterial[oPlan.material] || oDefaultLimits;
                oPlan = this._computeQtrTotals(oPlan, oMatLimits);

                var sMyKey    = oPlan.contract + "|" + String(iUserLevel);
                var sMyAction = oApprovalByLevel[sMyKey];

                var sPrevKey    = oPlan.contract + "|" + String(iUserLevel - 1);
                var sPrevAction = (iUserLevel === 1) ? "A" : oApprovalByLevel[sPrevKey];

                if (sMyAction === "A") {
                    oPlan.approvalStatus = "Approved";
                    oPlan.approvalState  = "Success";
                } else if (sMyAction === "R") {
                    oPlan.approvalStatus = "Rejected";
                    oPlan.approvalState  = "Error";
                } else if (sPrevAction === "A") {
                    oPlan.approvalStatus = "Pending";
                    oPlan.approvalState  = "Warning";
                } else {
                    oPlan.approvalStatus = "Awaiting";
                    oPlan.approvalState  = "None";
                }
                return oPlan;
            }.bind(this));
            aPlanRows = this._applyLevelFilter(aPlanRows);
            var oGlobalLimits = Object.values(oQtByMaterial)[0] || oDefaultLimits;
            var oKPI = this._calcKPIs(aPlanRows, oGlobalLimits);

            var oCurrentData = oModel.getData();
            oCurrentData.planRows         = aPlanRows;
            oCurrentData.filteredRows     = aPlanRows;
            oCurrentData.kpiSummary       = oKPI;
            oCurrentData.quarterlyLimits  = oGlobalLimits;
            oCurrentData.ui.dataLoaded    = true;
            oCurrentData.ui.busy          = false;
            oCurrentData.ui.lastRefreshed = this._nowString();
            oModel.setData(oCurrentData);
            oModel.refresh(true);

            MessageToast.show(
                aPlanRows.length + " plan(s) loaded. " +
                oKPI.violatingPlans + " violation(s) detected."
            );
        },

        _applyLevelFilter: function (aPlans) {
            var oModel = this.getView().getModel("dash");
            var iLevel = oModel.getProperty("/user/level");
            var aApproval = oModel.getProperty("/approvalData") || [];
            if (iLevel === 1) {
                return aPlans;
            }
            var aContracts = aApproval
                .filter(function (r) {
                    return r.Arlevel == (iLevel - 1) && r.Arindicator === "A";
                })
                .map(function (r) {
                    return r.ContractNo;
                });
            return aPlans.filter(function (p) {
                return aContracts.includes(p.contract);
            });
        },

        _computeQtrTotals: function (oPlan, oLimits) {
            var aacq = oPlan.aacq || 1;
            var q1 = (oPlan.jan||0)+(oPlan.feb||0)+(oPlan.mar||0);
            var q2 = (oPlan.apr||0)+(oPlan.may||0)+(oPlan.jun||0);
            var q3 = (oPlan.jul||0)+(oPlan.aug||0)+(oPlan.sep||0);
            var q4 = (oPlan.oct||0)+(oPlan.nov||0)+(oPlan.dec||0);
            var pct = function (v) { return Math.floor((v / aacq) * 100); };
            oPlan.q1 = q1; oPlan.q1Pct = pct(q1); oPlan.q1Limit = oLimits.q1Limit;
            oPlan.q2 = q2; oPlan.q2Pct = pct(q2); oPlan.q2Limit = oLimits.q2Limit;
            oPlan.q3 = q3; oPlan.q3Pct = pct(q3); oPlan.q3Limit = oLimits.q3Limit;
            oPlan.q4 = q4; oPlan.q4Pct = pct(q4); oPlan.q4Limit = oLimits.q4Limit;
            oPlan.q1State = this._getState(oPlan.q1Pct, oLimits.q1Limit);
            oPlan.q2State = this._getState(oPlan.q2Pct, oLimits.q2Limit);
            oPlan.q3State = this._getState(oPlan.q3Pct, oLimits.q3Limit);
            oPlan.q4State = this._getState(oPlan.q4Pct, oLimits.q4Limit);
            oPlan.annual      = q1+q2+q3+q4;
            oPlan.annualState = oPlan.annual > aacq   ? "Error"
                              : oPlan.annual === aacq  ? "Success"
                              : "Warning";
            return oPlan;
        },

        _getState: function (pct, limit) {
            var np = Math.floor(Number(pct));
            var nl = Math.floor(Number(limit));
            if (np === 0)  return "None";
            if (np > nl)   return "Error";
            if (np === nl) return "Success";
            return "Warning";
        },

        _calcKPIs: function (aRows, oLimits) {
            var cumAACQ=0, cumQ1=0, cumQ2=0, cumQ3=0, cumQ4=0,
                violating=0, compliant=0;
            aRows.forEach(function (r) {
                cumAACQ += (r.aacq||0);
                cumQ1   += (r.q1||0);
                cumQ2   += (r.q2||0);
                cumQ3   += (r.q3||0);
                cumQ4   += (r.q4||0);
                var bV = r.q1State==="Error" || r.q2State==="Error" ||
                         r.q3State==="Error" || r.q4State==="Error";
                if (bV) violating++; else compliant++;
            });
            var pct = function (v) { return cumAACQ ? Math.floor((v/cumAACQ)*100) : 0; };
            return {
                cumulativeAACQ:cumAACQ, cumulativeAACQUOM:"MBT",
                q1Total:cumQ1, q1Pct:pct(cumQ1), q1State:this._getState(pct(cumQ1),oLimits.q1Limit), q1Limit:oLimits.q1Limit,
                q2Total:cumQ2, q2Pct:pct(cumQ2), q2State:this._getState(pct(cumQ2),oLimits.q2Limit), q2Limit:oLimits.q2Limit,
                q3Total:cumQ3, q3Pct:pct(cumQ3), q3State:this._getState(pct(cumQ3),oLimits.q3Limit), q3Limit:oLimits.q3Limit,
                q4Total:cumQ4, q4Pct:pct(cumQ4), q4State:this._getState(pct(cumQ4),oLimits.q4Limit), q4Limit:oLimits.q4Limit,
                totalCustomers:aRows.length, compliantPlans:compliant, violatingPlans:violating
            };
        },

        //  EDIT PLAN
        onEditPlan: function (oEvent) {
            var oPlan = oEvent.getSource().getBindingContext("dash").getObject();
            this._openEditDialog(oPlan);
        },

        _openEditDialog: function (oPlan) {
            this._sEditPlanId = oPlan.planId || oPlan.contract;
            var oEditData     = jQuery.extend(true, {}, oPlan);
            if (!oEditData.monthlyPlan) {
                oEditData.monthlyPlan = {
                    jan:oEditData.jan||0, feb:oEditData.feb||0, mar:oEditData.mar||0,
                    apr:oEditData.apr||0, may:oEditData.may||0, jun:oEditData.jun||0,
                    jul:oEditData.jul||0, aug:oEditData.aug||0, sep:oEditData.sep||0,
                    oct:oEditData.oct||0, nov:oEditData.nov||0, dec:oEditData.dec||0
                };
            }
            oEditData.quarterlyLimits = this.getView().getModel("dash").getProperty("/quarterlyLimits");
            this._recalcEditTotals(oEditData);
            var oEditModel = new JSONModel(oEditData);
            if (!this._oEditDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.ingenx.annualplan.fragments.EditPlanDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oEditDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.setModel(oEditModel, "edit");
                    oDialog.open();
                }.bind(this));
            } else {
                this._oEditDialog.setModel(oEditModel, "edit");
                this._oEditDialog.open();
            }
        },

       onEditMonthChange: function (oEvent) {
            var oModel = this._oEditDialog.getModel("edit");
            var oData  = oModel.getData();
            var mp     = oData.monthlyPlan;
            var oInput = oEvent.getSource();
            var sPath  = oInput.getBindingPath("value"); 
            var nVal   = parseInt(oEvent.getParameter("value") || "0") || 0;
            oModel.setProperty(sPath, nVal);
            this._recalcEditTotals(oData);
            oModel.setData(oData);
        },

       _recalcEditTotals: function (oData) {
            var mp   = oData.monthlyPlan;
            var lim  = oData.quarterlyLimits;
            var aacq = oData.aacq || 1;

            var q1 = parseInt(mp.jan||0) + parseInt(mp.feb||0) + parseInt(mp.mar||0);
            var q2 = parseInt(mp.apr||0) + parseInt(mp.may||0) + parseInt(mp.jun||0);
            var q3 = parseInt(mp.jul||0) + parseInt(mp.aug||0) + parseInt(mp.sep||0);
            var q4 = parseInt(mp.oct||0) + parseInt(mp.nov||0) + parseInt(mp.dec||0);

            var pct = function (v) { return Math.floor((v / aacq) * 100); };
            oData.q1Total = q1; oData.q1Pct = pct(q1); oData.q1State = this._getState(pct(q1), lim.q1Limit);
            oData.q2Total = q2; oData.q2Pct = pct(q2); oData.q2State = this._getState(pct(q2), lim.q2Limit);
            oData.q3Total = q3; oData.q3Pct = pct(q3); oData.q3State = this._getState(pct(q3), lim.q3Limit);
            oData.q4Total = q4; oData.q4Pct = pct(q4); oData.q4State = this._getState(pct(q4), lim.q4Limit);
            oData.editAnnualTotal = q1 + q2 + q3 + q4;
        },

       onSaveEditedPlan: function () {
            var oEditData = this._oEditDialog.getModel("edit").getData();

            if (oEditData.editAnnualTotal !== oEditData.aacq) {
                MessageBox.error(
                    "Annual total (" + oEditData.editAnnualTotal +
                    ") ≠ AACQ (" + oEditData.aacq + "). Please adjust monthly quantities."
                );
                return;
            }
            var mp        = oEditData.monthlyPlan;
            var sYear     = String(new Date().getFullYear());
            var sValidFrom = oEditData.validFrom || "";
            var sValidTo   = oEditData.validTo   || "";

            var aMonthMap = [
                { sub:"JAN", key:"jan" }, { sub:"FEB", key:"feb" }, { sub:"MAR", key:"mar" },
                { sub:"APR", key:"apr" }, { sub:"MAY", key:"may" }, { sub:"JUN", key:"jun" },
                { sub:"JUL", key:"jul" }, { sub:"AUG", key:"aug" }, { sub:"SEP", key:"sep" },
                { sub:"OCT", key:"oct" }, { sub:"NOV", key:"nov" }, { sub:"DEC", key:"dec" }
            ];

            var aRows = aMonthMap.map(function (m) {
                return {
                    Period       : "M",
                    Calendaryear : sYear,
                    Aacq         : oEditData.aacq,
                    Material     : oEditData.material,
                    SubInterval  : m.sub,
                    Customer     : oEditData.customer,
                    ContractNo   : oEditData.contract,
                    ValidFrom    : sValidFrom,
                    ValidTo      : sValidTo,
                    Acq          : oEditData.aacq,
                    Uom          : oEditData.uom || "MBT",
                    Mqvalue      : parseInt(mp[m.key]) || 0,
                    Status       : "A",
                    UpwardFlexper: 0,
                    DnwardFlexper: 0,
                    Fmdeficiency : 0,
                    Makegood     : 0,
                    Makeup       : 0,
                    Toppercentage: 0,
                    Salesoffice  : oEditData.salesOffice || ""
                };
            });
            var oPayload = {
                Material    : oEditData.material,
                Customer    : oEditData.customer,
                ContractNo  : oEditData.contract,
                ValidFrom   : sValidFrom,
                ValidTo     : sValidTo,
                to_annualpln: aRows
            };
            console.log("Edit Plan Payload:", JSON.stringify(oPayload, null, 2));
            var oODataModel = this.getOwnerComponent().getModel();
            var oBindList   = oODataModel.bindList("/CreateAnnualplanSet");

            this.getView().getModel("dash").setProperty("/ui/busy", true);
            var oCtx = oBindList.create(oPayload, true);
            oCtx.created()
                .then(function () {
                    this.getView().getModel("dash").setProperty("/ui/busy", false);
                    var oModel = this.getView().getModel("dash");
                    var aRows  = oModel.getProperty("/filteredRows") || [];
                    var idx    = aRows.findIndex(function (r) {
                        return (r.planId || r.contract) === (oEditData.planId || oEditData.contract);
                    });
                    if (idx !== -1) {
                        Object.keys(mp).forEach(function (m) {
                            aRows[idx][m] = parseInt(mp[m]) || 0;
                        });
                        aRows[idx] = this._computeQtrTotals(
                            aRows[idx],
                            oModel.getProperty("/quarterlyLimits")
                        );
                        oModel.setProperty("/filteredRows", aRows);
                    }
                    this._oEditDialog.close();
                    MessageToast.show("Plan updated successfully.");
                }.bind(this))
                .catch(function (oErr) {
                    this.getView().getModel("dash").setProperty("/ui/busy", false);
                    var sMsg = "Update failed.";
                    try {
                        if (oErr.cause && oErr.cause.message) sMsg = oErr.cause.message;
                        else if (oErr.message) sMsg = oErr.message;
                    } catch (e) {}
                    MessageBox.error(sMsg, { title: "Update Failed" });
                }.bind(this));
        },

        onCancelEditPlan: function () {
            if (this._oEditDialog) this._oEditDialog.close();
        },

        //  DRILL DOWN
        onCustomerDrillDown: function (oEvent) {
            var oRow       = oEvent.getSource().getBindingContext("dash").getObject();
            var oLimits    = this.getView().getModel("dash").getProperty("/quarterlyLimits");
            var oDrillData = jQuery.extend(true, {}, oRow);
            oDrillData.quarterlyLimits = oLimits;
            oDrillData.monthlyRow = [{
                jan:oRow.jan, feb:oRow.feb, mar:oRow.mar,
                q1:oRow.q1,   q1State:oRow.q1State,
                apr:oRow.apr, may:oRow.may, jun:oRow.jun,
                q2:oRow.q2,   q2State:oRow.q2State,
                jul:oRow.jul, aug:oRow.aug, sep:oRow.sep,
                q3:oRow.q3,   q3State:oRow.q3State,
                oct:oRow.oct, nov:oRow.nov, dec:oRow.dec,
                q4:oRow.q4,   q4State:oRow.q4State,
                annual:oRow.annual, annualState:oRow.annualState
            }];
            var oDrillModel = new JSONModel(oDrillData);
            if (!this._oDrillDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.ingenx.annualplan.fragments.CustomerDrillDown",
                    controller: this
                }).then(function (oDialog) {
                    this._oDrillDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.setModel(oDrillModel, "drill");
                    oDialog.open();
                }.bind(this));
            } else {
                this._oDrillDialog.setModel(oDrillModel, "drill");
                this._oDrillDialog.open();
            }
        },

        onCloseDrillDown: function () {
            if (this._oDrillDialog) this._oDrillDialog.close();
        },

        //  REDUCTION CODE
       onPressReductionBtn: function (oEvent) {
            var oRowData = oEvent.getSource().getBindingContext("dash").getObject();
            var oLimits  = this.getView().getModel("dash").getProperty("/quarterlyLimits");
            var oMP = {
                jan:oRowData.jan||0, feb:oRowData.feb||0, mar:oRowData.mar||0,
                apr:oRowData.apr||0, may:oRowData.may||0, jun:oRowData.jun||0,
                jul:oRowData.jul||0, aug:oRowData.aug||0, sep:oRowData.sep||0,
                oct:oRowData.oct||0, nov:oRowData.nov||0, dec:oRowData.dec||0
            };
            this.getOwnerComponent().getModel("appState")
                .setProperty("/reductionPlan", {
                    planId      : oRowData.planId || oRowData.contract,
                    customer    : oRowData.customer,
                    customerId  : oRowData.customerId || oRowData.customer,
                    contract    : oRowData.contract,
                    material    : oRowData.material,
                    salesOffice : oRowData.salesOffice,
                    industry    : oRowData.industry || "",
                    uom         : oRowData.uom || "MBT",
                    aacq        : oRowData.aacq,
                    status      : oRowData.status || "APPROVED",
                    statusState : "Success",
                    originalPlan: jQuery.extend({}, oMP),
                    currentPlan : jQuery.extend({}, oMP),
                    quarterlyLimits: oLimits
                });
                this.getOwnerComponent().getRouter().navTo("onRouteReduction", {
                    material   : encodeURIComponent(oRowData.material    || "ALL"),
                    salesOffice: encodeURIComponent(oRowData.salesOffice || "ALL"),
                    customer   : encodeURIComponent(oRowData.customerId  || oRowData.customer || "ALL"),
                    contract   : encodeURIComponent(oRowData.contract    || "ALL"),
                    industry   : encodeURIComponent(oRowData.industry    || "ALL")
                });
            },

        //  APPROVAL BUTTON PRESS
        onPressApprovalBtn: function (oEvent) {
            var oRowData = oEvent.getSource().getBindingContext("dash").getObject();
            var oLimits  = this.getView().getModel("dash").getProperty("/quarterlyLimits");
            var oMP = {
                jan:oRowData.jan||0,feb:oRowData.feb||0,mar:oRowData.mar||0,
                apr:oRowData.apr||0,may:oRowData.may||0,jun:oRowData.jun||0,
                jul:oRowData.jul||0,aug:oRowData.aug||0,sep:oRowData.sep||0,
                oct:oRowData.oct||0,nov:oRowData.nov||0,dec:oRowData.dec||0
            };
            var aacq=oRowData.aacq||0;
            var q1=oMP.jan+oMP.feb+oMP.mar, q2=oMP.apr+oMP.may+oMP.jun;
            var q3=oMP.jul+oMP.aug+oMP.sep, q4=oMP.oct+oMP.nov+oMP.dec;
            var d=new Date(),mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            var sToday=d.getDate()+" "+mo[d.getMonth()]+" "+d.getFullYear();
            window.__approvalData = {
                requestId:"REQ-"+oRowData.contract, type:"ANNUAL_PLAN", typeLabel:"Annual Plan",
                customer:oRowData.customer, customerId:oRowData.customerId||oRowData.customer,
                contract:oRowData.contract, material:oRowData.material,
                salesOffice:oRowData.salesOffice||"", submittedBy:"Customer Portal",
                submittedOn:sToday, uom:oRowData.uom||"MBT", aacq:aacq,
                status:"PENDING", statusText:"Pending Approval", statusState:"Warning",
                priority:"MEDIUM", daysWaiting:0, approverComment:"",
                monthlyPlan:oMP,
                quarterlyTotals:{
                    q1:q1,q1Pct:oRowData.q1Pct,q1State:oRowData.q1State,
                    q2:q2,q2Pct:oRowData.q2Pct,q2State:oRowData.q2State,
                    q3:q3,q3Pct:oRowData.q3Pct,q3State:oRowData.q3State,
                    q4:q4,q4Pct:oRowData.q4Pct,q4State:oRowData.q4State
                },
                quarterlyLimits:oLimits, annualTotal:q1+q2+q3+q4,
                workflowSteps:[
                    {step:1,label:"Submitted by Customer",status:"DONE",   date:sToday,by:"Customer Portal"},
                    {step:2,label:"Zonal Review",         status:"DONE",   date:sToday,by:"Zonal Team"},
                    {step:3,label:"Corporate Approval",   status:"CURRENT",date:"",    by:""},
                    {step:4,label:"Contract Update",      status:"PENDING",date:"",    by:""}
                ]
            };
            this.getOwnerComponent().getRouter().navTo("onRouteApproval");
        },

        //  REJECT DIALOG CODE
        onRejectPlanDialog: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("dash");
            this._openRejectDialog(oContext.getObject(), oContext.getPath());
        },

        _openRejectDialog: function (oPlan) {
            var oDialogModel = new sap.ui.model.json.JSONModel({
                customer: oPlan.customer,
                contractNumber: oPlan.contract,
                rejectionReason: ""
            });
            if (!this._oRejectDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "com.ingenx.annualplan.fragments.RejectDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oRejectDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.setModel(oDialogModel, "dialog");
                    oDialog.open();
                }.bind(this));
            } else {
                this._oRejectDialog.setModel(oDialogModel, "dialog");
                this._oRejectDialog.open();
            }
        },

        onCancelReject: function () {
            if (this._oRejectDialog) this._oRejectDialog.close();
        },

        onRejectPlanDialog: function (oEvent) {
            var oRow = oEvent.getSource().getBindingContext("dash").getObject();
            this._aBulkRejectRows = [oRow]; 
            this._openRejectDialog(oRow);
        },


        onConfirmReject: function () {
            var oDialogModel = this._oRejectDialog.getModel("dialog");
            var sReason = oDialogModel.getProperty("/rejectionReason");

            if (!sReason || !sReason.trim()) {
                sap.m.MessageBox.error("Rejection reason is mandatory.");
                return;
            }
            var oDashModel = this.getView().getModel("dash");

            var sUser = oDashModel.getProperty("/user/sapUser");
            var sLevel = oDashModel.getProperty("/user/level");
            var oDate = new Date();
            var sDate = oDate.toISOString().split("T")[0];
            var sTime = oDate.toTimeString().split(" ")[0];
            var aRows = this._aBulkRejectRows || [];
            if (!aRows.length) {
                sap.m.MessageBox.error("No plans found to reject.");
                return;
            }
            var oModel = this.getOwnerComponent().getModel();
            var oBinding = oModel.bindList("/xGMSxAP_APPR");
            var iSuccess = 0;
            aRows.forEach(function (oRow) {
                var oPayload = {
                    ContractNo: oRow.contract,
                    Sapuser: sUser,
                    Salesoffice: oRow.salesOffice || "",
                    Arlevel: String(sLevel),
                    Arindicator: "R",
                    Remarks: sReason,
                    Ardate: sDate,
                    Artime: sTime
                };
                var oContext = oBinding.create(oPayload);
                oContext.created()
                    .then(function () {
                        iSuccess++;
                        if (iSuccess === aRows.length) {
                            sap.m.MessageToast.show(iSuccess + " plan(s) rejected successfully.");
                        }
                    })
                    .catch(function (oError) {
                        sap.m.MessageBox.error("Reject failed: " + (oError.message || oError));
                    });
            });
            this.byId("dashTable").clearSelection();
            this._oRejectDialog.close();
        },

        onApproveFromDialog: function () {
            var oApvModel  = this._oApprovalDialog.getModel("apv");
            var sContract  = oApvModel.getProperty("/contract");
            var sCustomer  = oApvModel.getProperty("/customer");

            sap.m.MessageBox.confirm(
                "Approve plan for:\nContract: " + sContract + "\nCustomer: " + sCustomer + "\n\nProceed?",
                {
                    title          : "Confirm Approval",
                    icon           : sap.m.MessageBox.Icon.SUCCESS,
                    actions        : [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                    emphasizedAction: sap.m.MessageBox.Action.YES,
                    onClose: function (sAction) {
                        if (sAction !== sap.m.MessageBox.Action.YES) return;
                        this._submitApproval("A");
                    }.bind(this)
                }
            );
        },

        onRejectFromDialog: function () {
            var oApvModel = this._oApprovalDialog.getModel("apv");
            var sComment  = (oApvModel.getProperty("/approverComment") || "").trim();
            var sContract = oApvModel.getProperty("/contract");
            var sCustomer = oApvModel.getProperty("/customer");
            if (!sComment) {
                sap.m.MessageBox.error("Please enter a reason before rejecting.");
                return;
            }
            sap.m.MessageBox.confirm(
                "Reject plan for:\nContract: " + sContract + "\nCustomer: " + sCustomer + "\n\nThis action will notify the customer. Proceed?",
                {
                    title          : "Confirm Rejection",
                    icon           : sap.m.MessageBox.Icon.WARNING,
                    actions        : [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                    emphasizedAction: sap.m.MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction !== sap.m.MessageBox.Action.YES) return;
                        this._submitApproval("R");
                    }.bind(this)
                }
            );
        },

        // Common submit function for approval and reject
        _submitApproval: function (sIndicator) {
            var oApvModel  = this._oApprovalDialog.getModel("apv");
            var oDashModel = this.getView().getModel("dash");
            var sUser  = oDashModel.getProperty("/user/sapUser");
            var sLevel = oDashModel.getProperty("/user/level");
            var oDate  = new Date();

            var oPayload = {
                ContractNo  : oApvModel.getProperty("/contract"),
                Sapuser     : sUser,
                Salesoffice : oApvModel.getProperty("/salesOffice") || "IN1",
                Arlevel     : String(sLevel),
                Arindicator : sIndicator,
                Remarks      : oApvModel.getProperty("/approverComment") || "",
                Ardate      : oDate.toISOString().split("T")[0],
                Artime      : oDate.toTimeString().split(" ")[0]
            };

            var oModel   = this.getOwnerComponent().getModel();
            var oBinding = oModel.bindList("/xGMSxAP_APPR");
            var oCtx     = oBinding.create(oPayload);

            oCtx.created()
                .then(function () {
                    var bApproved = sIndicator === "A";
                    oApvModel.setProperty("/status",     bApproved ? "APPROVED"  : "REJECTED");
                    oApvModel.setProperty("/statusText", bApproved ? "Approved"  : "Rejected");
                    oApvModel.setProperty("/statusState",bApproved ? "Success"   : "Error");

                    sap.m.MessageToast.show(bApproved ? "Plan approved successfully." : "Plan rejected.");
                    this._oApprovalDialog.close();
                    this._loadApprovalData();
                    setTimeout(function () { this.onApplyFilter(); }.bind(this), 600);
                }.bind(this))
                .catch(function (oErr) {
                    sap.m.MessageBox.error(
                        (sIndicator === "A" ? "Approval" : "Rejection") +
                        " failed: " + (oErr.message || oErr)
                    );
                }.bind(this));
        },

        //  GROUP BY
        onGroupByChange: function (oEvent) {
            var sKey     = oEvent.getSource().getSelectedKey();
            var oTable   = this.byId("dashTable");
            var oBinding = oTable.getBinding("rows");
            if (!oBinding) return;
            if (!sKey) { oBinding.sort([]); return; }
            oBinding.sort([new Sorter(sKey, false, function (oCtx) {
                return { key: oCtx.getProperty(sKey), text: oCtx.getProperty(sKey) };
            })]);
        },

        //  CLEAR / REFRESH / NAV
        onClearFilter: function () {
            var oModel = this.getView().getModel("dash");
            oModel.setProperty("/filters", {
                salesOffice:"", material:"", customer:"", customerName:"", contractNo:""
            });
            oModel.setProperty("/filteredRows",     []);
            oModel.setProperty("/planRows",         []);
            oModel.setProperty("/dashContractList", []);
            oModel.setProperty("/ui/dataLoaded",    false);

            ["dashMaterial","inputCustomerId","dashContractNo"].forEach(function (sId) {
                var oCtrl = this.byId(sId);
                if (oCtrl) oCtrl.setValue("");
            }.bind(this));

            MessageToast.show("Filters cleared.");
        },

        onRefresh: function () {
            var oModel = this.getView().getModel("dash");
            if (!oModel.getProperty("/ui/dataLoaded")) {
                MessageToast.show("Apply filters and click Go to load data.");
                return;
            }
            oModel.setProperty("/ui/busy", true);
            setTimeout(function () { this.onApplyFilter(); }.bind(this), 300);
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteMain");
        },

        //  LEGEND / EXPORT
        onShowLegend: function () {
            if (!this._oLegendDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.ingenx.annualplan.fragments.LegendDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oLegendDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this._oLegendDialog.open();
            }
        },

        onCloseLegend: function () { if (this._oLegendDialog) this._oLegendDialog.close(); },
        onExport: function () { MessageToast.show("Export – connect to sap.ui.export.Spreadsheet."); },

        //  FORMATTERS
        formatState: function (sState) {
            if (sState === "Success") return "Success";
            if (sState === "Error")   return "Error";
            if (sState === "Warning") return "Warning";
            return "None";
        },

        formatStateIcon: function (sState) {
            if (sState === "Error")   return "sap-icon://error";
            if (sState === "Warning") return "sap-icon://warning";
            if (sState === "Success") return "sap-icon://accept";
            return "";
        },

        _nowString: function () {
            var d=new Date(), mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            var hh=d.getHours(), mm=d.getMinutes(), ampm=hh>=12?"PM":"AM";
            hh=hh%12||12; mm=mm<10?"0"+mm:mm;
            return d.getDate()+" "+mo[d.getMonth()]+" "+d.getFullYear()+", "+hh+":"+mm+" "+ampm;
        },

        onBulkApprove: function () {
            var oTable = this.byId("dashTable");
            var aSelectedIndices = oTable.getSelectedIndices();
            if (!aSelectedIndices.length) {
                sap.m.MessageBox.warning("Please select at least one plan to approve.");
                return;
            }
            sap.m.MessageBox.confirm(
                "Approve " + aSelectedIndices.length + " selected plan(s)?",
                {
                    title: "Confirm Approval",
                    actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                    emphasizedAction: sap.m.MessageBox.Action.YES,
                    onClose: function (oAction) {
                        if (oAction !== sap.m.MessageBox.Action.YES) return;
                        var oDashModel = this.getView().getModel("dash");
                        var sUser = oDashModel.getProperty("/user/sapUser");
                        var sLevel = oDashModel.getProperty("/user/level");
                        var oDate = new Date();
                        var sDate = oDate.toISOString().split("T")[0];
                        var sTime = oDate.toTimeString().split(" ")[0];
                        var aPayload = [];
                        aSelectedIndices.forEach(function (iIndex) {
                            var oRow = oTable.getContextByIndex(iIndex).getObject();
                            aPayload.push({
                                ContractNo: oRow.contract,
                                Sapuser: sUser,
                                Salesoffice: oRow.salesOffice,
                                Arlevel: String(sLevel),
                                Arindicator: "A",
                                Ardate: sDate,
                                Artime: sTime
                            });
                        });
                        console.log("Bulk Approve Payload", aPayload);
                        var oModel = this.getOwnerComponent().getModel();
                        var oBinding = oModel.bindList("/xGMSxAP_APPR");
                        aPayload.forEach(function (oEntry) {
                            oBinding.create(oEntry);
                        });
                        sap.m.MessageToast.show(aPayload.length + " plan(s) approved.");
                        oTable.clearSelection();
                    }.bind(this)
                }
            );
        },

        onBulkReject: function () {
            var oTable = this.byId("dashTable");
            var aSelectedIndices = oTable.getSelectedIndices();
            if (!aSelectedIndices.length) {
                sap.m.MessageBox.warning("Please select at least one plan to reject.");
                return;
            }
            var aRows = [];
            aSelectedIndices.forEach(function (iIndex) {
                var oRow = oTable.getContextByIndex(iIndex).getObject();
                aRows.push(oRow);
            });
            this._aBulkRejectRows = aRows;
            this._openRejectDialog({
                customer: aRows.length + " selected plans",
                contract: "Multiple"
            });
        },


        onOpenViewDialog: function (oEvent) {
            var oRowData   = oEvent.getSource().getBindingContext("dash").getObject();
            var oDashModel = this.getView().getModel("dash");
            var oLimits    = oDashModel.getProperty("/quarterlyLimits");
            var aApprData  = oDashModel.getProperty("/approvalData") || [];
            var iUserLevel = oDashModel.getProperty("/user/level")   || 1;  // ← ADD

            var oMP = {
                jan:oRowData.jan||0, feb:oRowData.feb||0, mar:oRowData.mar||0,
                apr:oRowData.apr||0, may:oRowData.may||0, jun:oRowData.jun||0,
                jul:oRowData.jul||0, aug:oRowData.aug||0, sep:oRowData.sep||0,
                oct:oRowData.oct||0, nov:oRowData.nov||0, dec:oRowData.dec||0
            };
            var aacq = oRowData.aacq || 0;
            var q1=oMP.jan+oMP.feb+oMP.mar, q2=oMP.apr+oMP.may+oMP.jun;
            var q3=oMP.jul+oMP.aug+oMP.sep, q4=oMP.oct+oMP.nov+oMP.dec;

            var oMonthlyRow = [{
                jan:oMP.jan, feb:oMP.feb, mar:oMP.mar,
                q1:q1,       q1State:oRowData.q1State,
                apr:oMP.apr, may:oMP.may, jun:oMP.jun,
                q2:q2,       q2State:oRowData.q2State,
                jul:oMP.jul, aug:oMP.aug, sep:oMP.sep,
                q3:q3,       q3State:oRowData.q3State,
                oct:oMP.oct, nov:oMP.nov, dec:oMP.dec,
                q4:q4,       q4State:oRowData.q4State,
                annual:oRowData.annual, annualState:oRowData.annualState,
                janState:"None", febState:"None", marState:"None",
                aprState:"None", mayState:"None", junState:"None",
                julState:"None", augState:"None", sepState:"None",
                octState:"None", novState:"None", decState:"None"
            }];

            var aContractAppr = aApprData
                .filter(function (r) { return r.ContractNo === oRowData.contract; })
                .sort(function (a, b) { return parseInt(a.Arlevel) - parseInt(b.Arlevel); });

            var iMaxLevel = 0;
            aApprData.forEach(function (r) {
                var l = parseInt(r.Arlevel) || 0;
                if (l > iMaxLevel) iMaxLevel = l;
            });
            if (iMaxLevel < 3) iMaxLevel = 3;

            var oLevelMap = {};
            aContractAppr.forEach(function (r) {
                oLevelMap[r.Arlevel] = r;
            });

            var iCurrentLevel = 1;
            for (var l = 1; l <= iMaxLevel; l++) {
                if (oLevelMap[String(l)]) {
                    if (oLevelMap[String(l)].Arindicator === "A") {
                        iCurrentLevel = l + 1;
                    } else {
                        iCurrentLevel = l;
                        break;
                    }
                } else {
                    iCurrentLevel = l;
                    break;
                }
            }

            var aWorkflowSteps = [];
            for (var i = 1; i <= iMaxLevel; i++) {
                var oRec       = oLevelMap[String(i)];
                var bIsCurrent = (i === iCurrentLevel);
                var sIndicator = oRec ? oRec.Arindicator : "";
                var sUser      = oRec ? (iUserLevel <= 1 ? "" : oRec.Sapuser) : "";
                var sDate      = oRec ? (oRec.Ardate + " " + (oRec.Artime || "")).trim() : "";

                if (sIndicator === "R") {
                    aWorkflowSteps.push({
                        level     : i,
                        indicator : "R",
                        user      : sUser,
                        date      : sDate,
                        statusText: "Rejected",
                        isCurrent : false,
                        hasNext   : false
                    });
                    break;
                }

                aWorkflowSteps.push({
                    level     : i,
                    indicator : sIndicator,
                    user      : sUser,
                    date      : sDate,
                    statusText: sIndicator === "A" ? "Approved"
                            : bIsCurrent        ? "Pending"
                            :                     "Awaiting",
                    isCurrent : bIsCurrent,
                    hasNext   : (i < iMaxLevel)
                });
            }

            var d  = new Date();
            var mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            var sToday = d.getDate() + " " + mo[d.getMonth()] + " " + d.getFullYear();

            var oExistingRec = oLevelMap[String(iUserLevel)];
            var sRemarks     = oExistingRec ? (oExistingRec.Reason || "") : "";

            var sOverallStatus = oRowData.approvalStatus === "Approved" ? "APPROVED"
                            : oRowData.approvalStatus === "Rejected" ? "REJECTED"
                            : "PENDING";

            var oApvData = {
                requestId       : "REQ-" + oRowData.contract,
                type            : "ANNUAL_PLAN",
                typeLabel       : "Annual Plan",
                customer        : oRowData.customer,
                customerId      : oRowData.customerId || oRowData.customer,
                contract        : oRowData.contract,
                material        : oRowData.material,
                salesOffice     : oRowData.salesOffice || "",
                submittedBy     : "Customer Portal",
                submittedOn     : sToday,
                uom             : oRowData.uom || "MBT",
                aacq            : aacq,
                annualTotal     : oRowData.annual || 0,
                status          : sOverallStatus,
                statusText      : oRowData.approvalStatus || "Pending",
                statusState     : oRowData.approvalState  || "Warning",
                priority        : "MEDIUM",
                daysWaiting     : 0,
                approverComment : sRemarks,
                reductionApplied: false,
                monthlyRow      : oMonthlyRow,
                quarterlyTotals : {
                    q1:q1, q1Pct:oRowData.q1Pct, q1State:oRowData.q1State,
                    q2:q2, q2Pct:oRowData.q2Pct, q2State:oRowData.q2State,
                    q3:q3, q3Pct:oRowData.q3Pct, q3State:oRowData.q3State,
                    q4:q4, q4Pct:oRowData.q4Pct, q4State:oRowData.q4State
                },
                quarterlyLimits : oLimits,
                workflowSteps   : aWorkflowSteps
            };

            this._oCurrentApprovalRow = oRowData;
            var oApvModel = new sap.ui.model.json.JSONModel(oApvData);

            if (!this._oApprovalDialog) {
                sap.ui.core.Fragment.load({
                    id        : this.getView().getId(),
                    name      : "com.ingenx.annualplan.fragments.ApprovalRequest",
                    controller: this
                }).then(function (oDialog) {
                    this._oApprovalDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.setModel(oApvModel, "apv");
                    oDialog.open();
                }.bind(this));
            } else {
                this._oApprovalDialog.setModel(oApvModel, "apv");
                this._oApprovalDialog.open();
            }
        },

        onCloseApprovalDialog: function () {
            if (this._oApprovalDialog) this._oApprovalDialog.close();
        },

    });
});