/* checksum : 17756758fa73857610446658d510fc87 */
@cds.external : true
@m.IsDefaultEntityContainer : 'true'
@sap.message.scope.supported : 'true'
@sap.supported.formats : 'atom json xlsx'
service GMSANNUALPLANNING_SRV {
  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.pageable : 'false'
  @sap.content.version : '1'
  entity CreateAnnualQtrSet {
    @sap.display.format : 'Date'
    @sap.unicode : 'false'
    @sap.label : 'Valid From'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key ValidFrom : Date not null;
    @sap.display.format : 'Date'
    @sap.unicode : 'false'
    @sap.label : 'Valid To'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key ValidTo : Date not null;
    to_annualqtr : Association to many AnnualQtrpSet {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.pageable : 'false'
  @sap.content.version : '1'
  entity CreateAnnualplanSet {
    @sap.unicode : 'false'
    @sap.label : 'Material'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key Material : String(40) not null;
    @sap.unicode : 'false'
    @sap.label : 'Customer'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key Customer : String(10) not null;
    @sap.unicode : 'false'
    @sap.label : 'DocumentNo'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key ContractNo : String(10) not null;
    @sap.display.format : 'Date'
    @sap.unicode : 'false'
    @sap.label : 'Valid From'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key ValidFrom : Date not null;
    @sap.display.format : 'Date'
    @sap.unicode : 'false'
    @sap.label : 'Valid To'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key ValidTo : Date not null;
    to_annualpln : Association to many AnnualplanSet {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.pageable : 'false'
  @sap.content.version : '1'
  entity AnnualQtrpSet {
    @sap.unicode : 'false'
    @sap.label : 'Material'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key Material : String(40) not null;
    @sap.display.format : 'Date'
    @sap.unicode : 'false'
    @sap.label : 'Valid From'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key ValidFrom : Date not null;
    @sap.display.format : 'Date'
    @sap.unicode : 'false'
    @sap.label : 'Valid To'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key ValidTo : Date not null;
    @sap.unicode : 'false'
    @sap.label : 'Sub Interval'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key Subinterval : String(4) not null;
    @sap.unicode : 'false'
    @sap.label : 'Interval'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key Period : String(1) not null;
    @sap.unicode : 'false'
    @sap.label : 'Value'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Value : Decimal(6, 2) not null;
    @sap.unicode : 'false'
    @sap.label : 'Created By'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Createdby : String(15) not null;
    @odata.Type : 'Edm.DateTime'
    @odata.Precision : 7
    @sap.unicode : 'false'
    @sap.label : 'Created Date'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Createddate : Timestamp not null;
    @sap.unicode : 'false'
    @sap.label : 'Created Time'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Createdtime : Time not null;
    @sap.unicode : 'false'
    @sap.label : 'Changed By'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Changedby : String(15) not null;
    @odata.Type : 'Edm.DateTime'
    @odata.Precision : 7
    @sap.unicode : 'false'
    @sap.label : 'Change Date'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Changeddate : Timestamp not null;
    @sap.unicode : 'false'
    @sap.label : 'Change Time'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Changedtime : Time not null;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.pageable : 'false'
  @sap.content.version : '1'
  entity AnnualplanSet {
    @sap.unicode : 'false'
    @sap.label : 'Interval'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key Period : String(1) not null;
    @sap.unicode : 'false'
    @sap.label : 'Material'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key Material : String(40) not null;
    @sap.unicode : 'false'
    @sap.label : 'Sub Interval'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key SubInterval : String(4) not null;
    @sap.unicode : 'false'
    @sap.label : 'Customer'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key Customer : String(10) not null;
    @sap.unicode : 'false'
    @sap.label : 'DocumentNo'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key ContractNo : String(10) not null;
    @sap.display.format : 'Date'
    @sap.unicode : 'false'
    @sap.label : 'Valid From'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    ValidFrom : Date not null;
    @sap.display.format : 'Date'
    @sap.unicode : 'false'
    @sap.label : 'Valid To'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    ValidTo : Date not null;
    @sap.unicode : 'false'
    @sap.unit : 'Uom'
    @sap.label : 'ACQ'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Acq : Decimal(13, 3) not null;
    @sap.unicode : 'false'
    @sap.unit : 'Uom'
    @sap.label : 'AACQ'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Aacq : Decimal(13, 3) not null;
    @sap.unicode : 'false'
    @sap.unit : 'Uom'
    @sap.label : 'MQ Value'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Mqvalue : Decimal(13, 3) not null;
    @sap.unicode : 'false'
    @sap.label : 'UOM'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    @sap.semantics : 'unit-of-measure'
    Uom : String(3) not null;
    @sap.unicode : 'false'
    @sap.label : 'Annual Status'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Status : String(1) not null;
    @sap.unicode : 'false'
    @sap.label : 'Calendar Year'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Calendaryear : String(4) not null;
    @sap.unicode : 'false'
    @sap.label : 'Top Per'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Toppercentage : Decimal(6, 2) not null;
    @sap.unicode : 'false'
    @sap.label : 'UP Flexibility %'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    UpwardFlexper : Decimal(6, 2) not null;
    @sap.unicode : 'false'
    @sap.label : 'Downward Flex %'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    DnwardFlexper : Decimal(6, 2) not null;
    @sap.unicode : 'false'
    @sap.unit : 'Uom'
    @sap.label : 'Make Good'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Makegood : Decimal(13, 3) not null;
    @sap.unicode : 'false'
    @sap.unit : 'Uom'
    @sap.label : 'Make Up'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Makeup : Decimal(13, 3) not null;
    @sap.unicode : 'false'
    @sap.unit : 'Uom'
    @sap.label : 'FM deficiency'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Fmdeficiency : Decimal(13, 3) not null;
    @sap.display.format : 'Date'
    @sap.unicode : 'false'
    @sap.label : 'SD Start Date'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    SdstartDate : Date not null;
    @sap.display.format : 'Date'
    @sap.unicode : 'false'
    @sap.label : 'SD End Date'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    SdendDate : Date not null;
    @sap.unicode : 'false'
    @sap.label : 'Shutdown Days'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Sddays : String(2) not null;
    @sap.unicode : 'false'
    @sap.unit : 'Uom'
    @sap.label : 'Shutdown Value'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Sdvalue : Decimal(13, 3) not null;
    @sap.unicode : 'false'
    @sap.label : 'Shutdown Reason'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Sdreason : String(100) not null;
    @sap.unicode : 'false'
    @sap.label : 'Sales Office'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Salesoffice : String(4) not null;
    @sap.unicode : 'false'
    @sap.label : 'Created By'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Createdby : String(15) not null;
    @odata.Type : 'Edm.DateTime'
    @odata.Precision : 7
    @sap.unicode : 'false'
    @sap.label : 'Created Date'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Createddate : Timestamp not null;
    @sap.unicode : 'false'
    @sap.label : 'Created Time'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Createdtime : Time not null;
    @sap.unicode : 'false'
    @sap.label : 'Changed By'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Changedby : String(15) not null;
    @odata.Type : 'Edm.DateTime'
    @odata.Precision : 7
    @sap.unicode : 'false'
    @sap.label : 'Change Date'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Changeddate : Timestamp not null;
    @sap.unicode : 'false'
    @sap.label : 'Change Time'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    Changedtime : Time not null;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Fetch Annual Quarterly Report'
  entity xGMSxANNUAL_QT {
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number'
    key Material : String(40) not null;
    @sap.display.format : 'Date'
    @sap.label : 'Valid From'
    key ValidFrom : Date not null;
    @sap.display.format : 'Date'
    @sap.label : 'Valid To'
    key ValidTo : Date not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sub Interval'
    key Subinterval : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Interval'
    @sap.quickinfo : 'Annual Interval'
    key Period : String(1) not null;
    @sap.label : 'Value'
    @sap.quickinfo : 'Interval Value'
    Value : Decimal(6, 2);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Created By'
    Createdby : String(15);
    @sap.display.format : 'Date'
    @sap.label : 'Created Date'
    Createddate : Date;
    @sap.label : 'Created Time'
    Createdtime : Time;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Changed By'
    Changedby : String(15);
    @sap.display.format : 'Date'
    @sap.label : 'Change Date'
    @sap.quickinfo : 'Changed Date'
    Changeddate : Date;
    @sap.label : 'Change Time'
    @sap.quickinfo : 'Changed Time'
    Changedtime : Time;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Annual Planning Approval'
  entity xGMSxAP_APPR {
    @sap.display.format : 'UpperCase'
    @sap.label : 'DocumentNo'
    @sap.quickinfo : 'Document Number'
    key ContractNo : String(10) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'User'
    @sap.quickinfo : 'User Name in User Master Record'
    key Sapuser : String(12) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sales Office'
    key Salesoffice : String(4) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'AP Level'
    key Arlevel : String(1) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'AR Remark'
    @sap.quickinfo : 'Approval Reject Remark'
    Remarks : String(100);
    @sap.display.format : 'UpperCase'
    @sap.label : 'AR Indicator'
    Arindicator : String(1);
    @sap.display.format : 'Date'
    @sap.label : 'AR Date'
    Ardate : Date;
    @sap.label : 'AR TIME'
    @sap.quickinfo : 'AR Time'
    Artime : Time;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Fetch Contract Data for Annual Plan'
  entity xGMSxAP_CONTRACT {
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sales Contract'
    key ContractNo : String(10) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sales Office'
    key SalesOffice : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sold-to Party'
    key Customer : String(10) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number'
    key Material : String(40) not null;
    @sap.label : 'Name of Customer'
    CustomerName : String(80);
    @sap.display.format : 'Date'
    @sap.label : 'Valid-From Date'
    @sap.quickinfo : 'Valid-From Date (Outline Agreements, Product Proposals)'
    ValidFrom : Date;
    @sap.display.format : 'Date'
    @sap.label : 'Valid-To Date'
    @sap.quickinfo : 'Valid-To Date (Outline Agreements, Product Proposals)'
    ValidTo : Date;
    @sap.unit : 'Uom'
    @sap.label : 'ACQ'
    @sap.quickinfo : 'Create Contract ACQ'
    ACQ : Decimal(13, 3);
    @sap.label : 'UOM'
    @sap.quickinfo : 'Unit of Measurement'
    @sap.semantics : 'unit-of-measure'
    Uom : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Clause Description'
    @sap.quickinfo : 'Clause Code Description'
    FinancialParamDesc : String(50);
    @sap.label : 'Threshold Perc'
    @sap.quickinfo : 'Threshold Percentage'
    ThresholdPer : Decimal(3, 0);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Annual Plan Data'
  entity xGMSxAP_DATA {
    @sap.display.format : 'UpperCase'
    @sap.label : 'Interval'
    @sap.quickinfo : 'Annual Interval'
    key Period : String(1) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number'
    key Material : String(40) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sub Interval'
    key SubInterval : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Customer'
    @sap.quickinfo : 'Customer No'
    key Customer : String(10) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'DocumentNo'
    @sap.quickinfo : 'Document Number'
    key ContractNo : String(10) not null;
    @sap.display.format : 'Date'
    @sap.label : 'Valid From'
    ValidFrom : Date;
    @sap.display.format : 'Date'
    @sap.label : 'Valid To'
    ValidTo : Date;
    @sap.unit : 'Uom'
    @sap.label : 'ACQ'
    @sap.quickinfo : 'Create Contract ACQ'
    Acq : Decimal(13, 3);
    @sap.unit : 'Uom'
    @sap.label : 'AACQ'
    @sap.quickinfo : 'Adjusted Annual Contractual Quantity'
    Aacq : Decimal(13, 3);
    @sap.label : 'UOM'
    @sap.quickinfo : 'Unit of Measurement'
    @sap.semantics : 'unit-of-measure'
    Uom : String(3);
    @sap.unit : 'Uom'
    @sap.label : 'MQ Value'
    @sap.quickinfo : 'Quatity Value'
    Mqvalue : Decimal(13, 3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Annual Status'
    Status : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Calendar Year'
    Calendaryear : String(4);
    @sap.label : 'UP Flexibility %'
    @sap.quickinfo : 'Upward Flexibility Percentage'
    UpwardFlexper : Decimal(6, 2);
    @sap.label : 'Downward Flex %'
    @sap.quickinfo : 'Downward Flexibility %'
    DnwardFlexper : Decimal(6, 2);
    @sap.unit : 'Uom'
    @sap.label : 'FM deficiency'
    @sap.quickinfo : 'FM Deficiency'
    Fmdeficiency : Decimal(13, 3);
    @sap.unit : 'Uom'
    @sap.label : 'Make Good'
    Makegood : Decimal(13, 3);
    @sap.unit : 'Uom'
    @sap.label : 'Make Up'
    Makeup : Decimal(13, 3);
    @sap.label : 'Top Per'
    @sap.quickinfo : 'Take Or Pay'
    Toppercentage : Decimal(6, 2);
    @sap.display.format : 'Date'
    @sap.label : 'SD Start Date'
    @sap.quickinfo : 'Shutdown Start Date'
    SdstartDate : Date;
    @sap.display.format : 'Date'
    @sap.label : 'SD End Date'
    @sap.quickinfo : 'Shutdown End Date'
    SdendDate : Date;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Shutdown Days'
    Sddays : String(2);
    @sap.unit : 'Uom'
    @sap.label : 'Shutdown Value'
    Sdvalue : Decimal(13, 3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Shutdown Reason'
    Sdreason : String(100);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sales Office'
    Salesoffice : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Created By'
    Createdby : String(15);
    @sap.display.format : 'Date'
    @sap.label : 'Created Date'
    Createddate : Date;
    @sap.label : 'Created Time'
    Createdtime : Time;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Changed By'
    Changedby : String(15);
    @sap.display.format : 'Date'
    @sap.label : 'Change Date'
    @sap.quickinfo : 'Changed Date'
    Changeddate : Date;
    @sap.label : 'Change Time'
    @sap.quickinfo : 'Changed Time'
    Changedtime : Time;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Fetch Material For Annual Planning'
  entity xGMSxAP_MATERIAL {
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number'
    key Material : String(40) not null;
    @sap.label : 'Material Description'
    key MaterialDesc : String(40) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material Type'
    MaterialType : String(4);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Sales Office Data'
  entity xGMSxSALESOFFICE {
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sales Office'
    key SalesOffice : String(4) not null;
  };
};

