export class IncludeDefinition {
  includesObsoletos: string[] = [
    'PROTHEUS.CH',
    'DIALOG.CH',
    'FONT.CH',
    'PTMENU.CH',
    'PRINT.CH',
    'COLORS.CH',
    'FOLDER.CH',
    'MSOBJECT.CH',
    'VKEY.CH',
    'WINAPI.CH',
    'FWCOMMAND.CH',
    'FWCSS.CH',
  ];
  includeExpressoes: {
    expressoes: RegExp[];
    include: string;
    includes: string[];
  }[] = [];

  constructor() {
    this.includeExpressoes = [];
    //AP5MAIL.CH
    this.includeExpressoes.push({
      expressoes: [
        /CONNECT\sSMTP\sSERVER/gim,
        /CONNECT\sPOP\sSERVER/gim,
        /DISCONNECT\sSMTP\sSERVER/gim,
        /DISCONNECT\sPOP\sSERVER/gim,
        /POP\sMESSAGE\sCOUNT/gim,
        /SEND\sMAIL\sFROM/gim,
        /GET\sMAIL\sERROR/gim,
        /RECEIVE\sMAIL\sMESSAGE/gim,
      ],
      include: 'AP5MAIL.CH',
      includes: [],
    });
    //APVISIO.CH

    //APWEB.CH
    this.includeExpressoes.push({
      expressoes: [/APWEB\sINIT\s.\sUSING/gim, /APWEB\sEND/gim],
      include: 'APWEB.CH',
      includes: [],
    });
    //APWEBEX.CH
    this.includeExpressoes.push({
      expressoes: [
        /OPEN\sQUERY\sALIAS/gim,
        /CLOSE\sQUERY/gim,
        /WEB\sEXTENDED\sINIT/gim,
        /WEB\sEXTENDED\sEND/gim,
      ],
      include: 'APWEBEX.CH',
      includes: [],
    });
    //APWEBSRV.CH
    this.includeExpressoes.push({
      expressoes: [
        /(\s|\(|\,)+SOAPFAULT_VERSIONMISMATCH/gim,
        /(\s|\(|\,)+SOAPFAULT_MUSTUNDERSTAND/gim,
        /(\s|\(|\,)+SOAPFAULT_DTDNOTSUPPORTED/gim,
        /(\s|\(|\,)+SOAPFAULT_DATAENCODINGUNKNOWN/gim,
        /(\s|\(|\,)+SOAPFAULT_SENDER/gim,
        /(\s|\(|\,)+SOAPFAULT_RECEIVER/gim,
        /(\s|\(|\,)+BYREF/gim,
        /(^|\s)+WSSTRUCT/gim,
        /(^|\s)+WSSERVICE/gim,
        /(^|\s)+WSCLIENT/gim,
      ],
      include: 'APWEBSRV.CH',
      includes: [],
    });
    //APWIZARD.CH
    this.includeExpressoes.push({
      expressoes: [
        /DEFINE\sWIZARD/gim,
        /ACTIVATE\sWIZARD/gim,
        /CREATE\sPANEL/gim,
      ],
      include: 'APWIZARD.CH',
      includes: [],
    });
    //AVPRINT.CH

    //AXSDEF.CH

    //BIRTDATASET.CH

    //COLORS.CH - DENTRO DO PROTHEUS.CH
    //COMMON.CH

    //CONSTANT.CH

    //DBFCDXAX.CH

    //TOPCONN.CH
    this.includeExpressoes.push({
      expressoes: [/TCQUERY+(\s)/gim],
      include: 'TOPCONN.CH',
      includes: [],
    });
    //TBICONN.CH
    this.includeExpressoes.push({
      expressoes: [
        /CREATE\sRPCCONN+(\s)/gim,
        /CLOSE\sRPCCONN+(\s)/gim,
        /PREPARE\sENVIRONMENT+(\s)/gim,
        /RESET\sENVIRONMENT+(\s)/gim,
        /OPEN\sREMOTE\sTRANSACTION+(\s)/gim,
        /CLOSE\sREMOTE\sTRANSACTION+(\s)/gim,
        /CALLPROC\sIN+(\s)/gim,
        /OPEN\sREMOTE\sTABLES+(\s)/gim,
      ],
      include: 'TBICONN.CH',
      includes: ['AP5MAIL.CH'],
    });
    //REPORT.CH
    this.includeExpressoes.push({
      expressoes: [
        /DEFINE\sREPORT\s.\sNAME+(\s)/gim,
        /DEFINE\sSECTION\s.\sOF+(\s)/gim,
        /DEFINE\sCELL\sNAME\s.\sOF+(\s)/gim,
        /DEFINE\sBREAK\sOF+(\s)/gim,
        /DEFINE\sFUNCTION\sFROM+(\s)/gim,
        /DEFINE\sCOLLECTION\s.\sOF+(\s)/gim,
        /DEFINE\sBORDER\s.\sOF\s/gim,
        /DEFINE\sHEADER\sBORDER\s.\sOF+(\s)/gim,
        /DEFINE\sCELL\sBORDER\s.\sOF+(\s)/gim,
        /DEFINE\sCELL\sHEADER\sBORDER\s.\sOF+(\s)/gim,
      ],
      include: 'REPORT.CH',
      includes: [],
    });
    //RESTFUL.CH
    this.includeExpressoes.push({
      expressoes: [
        /(^|\s)+WSRESTFUL/gim,
        /(^|\s)+WADL/gim,
        /(^|\s)+WADLMETHOD/gim,
      ],
      include: 'RESTFUL.CH',
      includes: ['APWEBSRV.CH'],
    });
    //FILEIO.CH
    this.includeExpressoes.push({
      expressoes: [
        /(\s|\(|\,)+F_ERROR/gim,
        /(\s|\(|\,)+FS_SET/gim,
        /(\s|\(|\,)+FS_RELATIVE/gim,
        /(\s|\(|\,)+FS_END/gim,
        /(\s|\(|\,)+FO_READ/gim,
        /(\s|\(|\,)+FO_WRITE/gim,
        /(\s|\(|\,)+FO_READWRITE/gim,
        /(\s|\(|\,)+FO_COMPAT/gim,
        /(\s|\(|\,)+FO_EXCLUSIVE/gim,
        /(\s|\(|\,)+FO_DENYWRITE/gim,
        /(\s|\(|\,)+FO_DENYREAD/gim,
        /(\s|\(|\,)+FO_DENYNONE/gim,
        /(\s|\(|\,)+FO_SHARED/gim,
        /(\s|\(|\,)+FC_NORMAL/gim,
        /(\s|\(|\,)+FC_READONLY/gim,
        /(\s|\(|\,)+FC_HIDDEN/gim,
        /(\s|\(|\,)+FC_SYSTEM/gim,
        /(\s|\(|\,)+FD_RAW/gim,
        /(\s|\(|\,)+FD_BINARY/gim,
        /(\s|\(|\,)+FD_COOKED/gim,
        /(\s|\(|\,)+FD_TEXT/gim,
        /(\s|\(|\,)+FD_ASCII/gim,
      ],
      include: 'FILEIO.CH',
      includes: [],
    });
    //TBICODE.CH
    this.includeExpressoes.push({
      expressoes: [
        /(\s|\(|\,)+RPC_LOGIN/gim,
        /(\s|\(|\,)+RPC_LOGOFF/gim,
        /(\s|\(|\,)+RPC_SEND_COTACAO/gim,
        /(\s|\(|\,)+RPC_ESTORNA_COTACAO/gim,
        /(\s|\(|\,)+RPC_READ_COTACAO/gim,
        /(\s|\(|\,)+RPC_SEND_ORCAMENTO/gim,
        /(\s|\(|\,)+RPC_ESTORNA_ORCAMENTO/gim,
        /(\s|\(|\,)+RPC_READ_ORCAMENTO/gim,
      ],
      include: 'TBICODE.CH',
      includes: [],
    });
    //PARMTYPE.CH
    this.includeExpressoes.push({
      expressoes: [
        /(\s|\(|\,)+PARAMEXCEPTION/gim,
        /(\s|\(|\,)+CLASSEXCEPTION/gim,
        /(\s|\(|\,)+CLASSPARAMEXCEPTION/gim,
        /(\s|\(|\,)+BLOCKPARAMEXCEPTION/gim,
        /(\s|\(|\,)+PARAMTYPE/gim,
      ],
      include: 'PARMTYPE.CH',
      includes: [],
    });
    //FWMVCDEF.CH
    this.includeExpressoes.push({
      expressoes: [
        /(\s|\(|\,)+FORM_STRUCT_TABLE_/gim,
        /(\s|\(|\,)+FORM_STRUCT_CARGO_/gim,
        /(\s|\(|\,)+MVC_BUTTON_/gim,
        /(\s|\(|\,)+MVC_TOOLBAR_/gim,
        /(\s|\(|\,)+MODELO_PK_/gim,
        /(\s|\(|\,)+MODEL_TRIGGER_/gim,
        /(\s|\(|\,)+MODEL_FIELD_/gim,
        /(\s|\(|\,)+MODEL_RELATION_/gim,
        /(\s|\(|\,)+MODEL_STRUCT_/gim,
        /(\s|\(|\,)+STRUCT_FEATURE_/gim,
        /(\s|\(|\,)+STRUCT_RULES_/gim,
        /(\s|\(|\,)+MODEL_GRID_/gim,
        /(\s|\(|\,)+MODEL_GRIDLINE_/gim,
        /(\s|\(|\,)+MODEL_RULES_/gim,
        /(\s|\(|\,)+MODEL_MSGERR_/gim,
        /(\s|\(|\,)+MODEL_OPERATION_/gim,
        /(\s|\(|\,)+MVC_LOADFILTER_/gim,
        /(\s|\(|\,)+MODEL_CONTROL_/gim,
        /(\s|\(|\,)+VIEWS_VIEW_/gim,
        /(\s|\(|\,)+MVC_VIEW_/gim,
        /(\s|\(|\,)+MVC_MODEL_/gim,
        /(\s|\(|\,)+FORMSTRUFIELD/gim,
        /(\s|\(|\,)+FORMSTRUTRIGGER/gim,
        /(\s|\(|\,)+VIEWSTRUFIELD/gim,
        /(\s|\(|\,)+VIEWSTRUFOLDER/gim,
        /(\s|\(|\,)+VIEWSTRUDOCKWINDOW/gim,
        /(\s|\(|\,)+VIEWSTRUGROUP/gim,
        /(\s|\(|\,)+VIEW_BUTTON_/gim,
        /(\s|\(|\,)+OP_PESQUISAR/gim,
        /(\s|\(|\,)+OP_VISUALIZAR/gim,
        /(\s|\(|\,)+OP_INCLUIR/gim,
        /(\s|\(|\,)+OP_ALTERAR/gim,
        /(\s|\(|\,)+OP_EXCLUIR/gim,
        /(\s|\(|\,)+OP_IMPRIMIR/gim,
        /(\s|\(|\,)+OP_COPIA/gim,
        /(^|\s)+ADD\sFWTOOLBUTTON/gim,
        /(^|\s)+NEW\sMODEL/gim,
        /(^|\s)+PUBLISH\sMODEL\sREST\sNAME/gim,
        /(^|\s)+ADD\sOPTION\s(.|)+(\s|)+TITLE+(\s|)+(.|)+(\s|)+ACTION\s(.|)+(\s|)+OPERATION\s(.|)\sACCESS/gim,
      ],
      include: 'FWMVCDEF.CH',
      includes: ['PARMTYPE.CH', 'FWMBROWSE.CH'],
    });
    //AARRAY.CH
    this.includeExpressoes.push({
      expressoes: [/\[+(\s|)+\#+(.|)+\]/gim],
      include: 'AARRAY.CH',
      includes: [],
    });
    //RPTDEF.CH
    this.includeExpressoes.push({
      expressoes: [
        /(\s|\(|\,)+CELL_ALIGN_LEFT/gim,
        /(\s|\(|\,)+CELL_ALIGN_CENTER/gim,
        /(\s|\(|\,)+CELL_ALIGN_RIGHT/gim,
        /(\s|\(|\,)+BORDER_NONE/gim,
        /(\s|\(|\,)+BORDER_CONTINUOUS/gim,
        /(\s|\(|\,)+BORDER_PARENT/gim,
        /(\s|\(|\,)+BORDER_HEADERPARENT/gim,
        /(\s|\(|\,)+BORDER_CELL/gim,
        /(\s|\(|\,)+BORDER_FUNCTION/gim,
        /(\s|\(|\,)+BORDER_SECTION/gim,
        /(\s|\(|\,)+EDGE_TOP/gim,
        /(\s|\(|\,)+EDGE_BOTTOM/gim,
        /(\s|\(|\,)+EDGE_LEFT/gim,
        /(\s|\(|\,)+EDGE_RIGHT/gim,
        /(\s|\(|\,)+EDGE_ALL/gim,
        /(\s|\(|\,)+NEGATIVE_PARENTHESES/gim,
        /(\s|\(|\,)+NEGATIVE_SIGNAL/gim,
        /(\s|\(|\,)+IMP_DISCO/gim,
        /(\s|\(|\,)+IMP_SPOOL/gim,
        /(\s|\(|\,)+IMP_EMAIL/gim,
        /(\s|\(|\,)+IMP_EXCEL/gim,
        /(\s|\(|\,)+IMP_HTML/gim,
        /(\s|\(|\,)+IMP_PDF/gim,
        /(\s|\(|\,)+IMP_ODF/gim,
        /(\s|\(|\,)+IMP_PDFMAIL/gim,
        /(\s|\(|\,)+IMP_MAILCOMPROVA/gim,
        /(\s|\(|\,)+IMP_ECM/gim,
        /(\s|\(|\,)+AMB_SERVER/gim,
        /(\s|\(|\,)+AMB_CLIENT/gim,
        /(\s|\(|\,)+AMB_ECM+(\s)/gim,
        /(\s|\(|\,)+PORTRAIT+(\s)/gim,
        /(\s|\(|\,)+LANDSCAPE+(\s)/gim,
        /(\s|\(|\,)+NO_REMOTE/gim,
        /(\s|\(|\,)+REMOTE_DELPHI/gim,
        /(\s|\(|\,)+REMOTE_QTWIN/gim,
        /(\s|\(|\,)+REMOTE_QTLINUX/gim,
        /(\s|\(|\,)+TYPE_CELL/gim,
        /(\s|\(|\,)+TYPE_FORMULA/gim,
        /(\s|\(|\,)+TYPE_FUNCTION/gim,
        /(\s|\(|\,)+TYPE_USER/gim,
        /(\s|\(|\,)+COLLECTION_VALUE/gim,
        /(\s|\(|\,)+COLLECTION_REPORT/gim,
        /(\s|\(|\,)+COLLECTION_SECTION/gim,
        /(\s|\(|\,)+COLLECTION_PAGE/gim,
        /(\s|\(|\,)+TSEEK/gim,
        /(\s|\(|\,)+TCACHE/gim,
        /(\s|\(|\,)+TSTRUCT/gim,
        /(\s|\(|\,)+TALIAS/gim,
        /(\s|\(|\,)+TDESC/gim,
        /(\s|\(|\,)+FSTRUCTALL/gim,
        /(\s|\(|\,)+FSTRUCTFIELD/gim,
        /(\s|\(|\,)+FTITLE/gim,
        /(\s|\(|\,)+FTOOLTIP/gim,
        /(\s|\(|\,)+FFIELD/gim,
        /(\s|\(|\,)+FTYPE/gim,
        /(\s|\(|\,)+FSIZE/gim,
        /(\s|\(|\,)+FDECIMAL/gim,
        /(\s|\(|\,)+FCOMBOBOX/gim,
        /(\s|\(|\,)+FOBRIGAT/gim,
        /(\s|\(|\,)+FUSED/gim,
        /(\s|\(|\,)+FCONTEXT/gim,
        /(\s|\(|\,)+FNIVEL/gim,
        /(\s|\(|\,)+FTABLE/gim,
        /(\s|\(|\,)+FPICTURE/gim,
        /(\s|\(|\,)+FCONPAD/gim,
        /(\s|\(|\,)+ISTRUCTALL/gim,
        /(\s|\(|\,)+ISTRUCTINDEX/gim,
        /(\s|\(|\,)+IDESC/gim,
        /(\s|\(|\,)+IKEY/gim,
        /(\s|\(|\,)+IDESC/gim,
        /(\s|\(|\,)+ITABLE/gim,
        /(\s|\(|\,)+PGROUP/gim,
        /(\s|\(|\,)+PORDER/gim,
        /(\s|\(|\,)+PGSC/gim,
        /(\s|\(|\,)+PTYPE/gim,
        /(\s|\(|\,)+PDESC/gim,
        /(\s|\(|\,)+PPERG1/gim,
        /(\s|\(|\,)+PPERG2/gim,
        /(\s|\(|\,)+PPERG3/gim,
        /(\s|\(|\,)+PPERG4/gim,
        /(\s|\(|\,)+PPERG5/gim,
        /(\s|\(|\,)+PPYME/gim,
        /(\s|\(|\,)+PPICTURE/gim,
      ],
      include: 'RPTDEF.CH',
      includes: [],
    });
    //FWPRINTSETUP.CH
    this.includeExpressoes.push({
      expressoes: [
        /(\s|\(|\,)+PD_ISTOTVSPRINTER/gim,
        /(\s|\(|\,)+PD_DISABLEDESTINATION/gim,
        /(\s|\(|\,)+PD_DISABLEORIENTATION/gim,
        /(\s|\(|\,)+PD_DISABLEPAPERSIZE/gim,
        /(\s|\(|\,)+PD_DISABLEPREVIEW/gim,
        /(\s|\(|\,)+PD_DISABLEMARGIN/gim,
        /(\s|\(|\,)+PD_TYPE_FILE/gim,
        /(\s|\(|\,)+PD_TYPE_SPOOL/gim,
        /(\s|\(|\,)+PD_TYPE_EMAIL/gim,
        /(\s|\(|\,)+PD_TYPE_EXCEL/gim,
        /(\s|\(|\,)+PD_TYPE_HTML/gim,
        /(\s|\(|\,)+PD_TYPE_PDF/gim,
        /(\s|\(|\,)+PD_DESTINATION/gim,
        /(\s|\(|\,)+PD_PRINTTYPE/gim,
        /(\s|\(|\,)+PD_ORIENTATION/gim,
        /(\s|\(|\,)+PD_PAPERSIZE/gim,
        /(\s|\(|\,)+PD_PREVIEW/gim,
        /(\s|\(|\,)+PD_VALUETYPE/gim,
        /(\s|\(|\,)+PD_MARGIN/gim,
        /(\s|\(|\,)+PD_MARGIN_LEFT/gim,
        /(\s|\(|\,)+PD_MARGIN_TOP/gim,
        /(\s|\(|\,)+PD_MARGIN_RIGHT/gim,
        /(\s|\(|\,)+PD_MARGIN_BOTTOM/gim,
        /(\s|\(|\,)+PD_OK/gim,
        /(\s|\(|\,)+PD_CANCEL/gim,
      ],
      include: 'FWPRINTSETUP.CH',
      includes: [],
    });
    //MSOLE.CH
    this.includeExpressoes.push({
      expressoes: [
        /(\s|\(|\,)+OLEONERROR/gim,
        /(\s|\(|\,)+OLEWDLEFT/gim,
        /(\s|\(|\,)+OLEWDTOP/gim,
        /(\s|\(|\,)+OLEWDWIDTH/gim,
        /(\s|\(|\,)+OLEWDHEIGHT/gim,
        /(\s|\(|\,)+OLEWDCAPTION/gim,
        /(\s|\(|\,)+OLEWDVISIBLE/gim,
        /(\s|\(|\,)+OLEWDWINDOWSTATE/gim,
        /(\s|\(|\,)+OLEWDPRINTBACK/gim,
        /(\s|\(|\,)+OLEWDVERSION/gim,
        /(\s|\(|\,)+OLEWDFORMATDOCUMENT/gim,
        /(\s|\(|\,)+OLEWDFORMATTEMPLATE/gim,
        /(\s|\(|\,)+OLEWDFORMATTEXT/gim,
        /(\s|\(|\,)+OLEWDFORMATTEXTLINEBREAKS/gim,
        /(\s|\(|\,)+OLEWDFORMATDOSTEXT/gim,
        /(\s|\(|\,)+OLEWDFORMATDOSTEXTLINEBREAKS/gim,
        /(\s|\(|\,)+OLEWDFORMATRTF/gim,
        /(\s|\(|\,)+OLEWDFORMATUNICODETEXT/gim,
        /(\s|\(|\,)+WDFORMATHTML/gim,
        /(\s|\(|\,)+WDFORMATDOCUMENTDEFAULT/gim,
        /(\s|\(|\,)+OLEWDFORMATHTML/gim,
      ],
      include: 'MSOLE.CH',
      includes: [],
    });
    //RWMAKE.CH
    this.includeExpressoes.push({
      expressoes: [
        /@\s.+\,+.\sTO\s.+\,+.\sDIALOG/gim,
        /@\s.+\,+.\sBMPBUTTON/gim,
      ],
      include: 'RWMAKE.CH',
      includes: ['STDWIN.CH'],
    });
  }
}
