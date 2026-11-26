/* Planilha .xlsx feita no próprio aparelho, sem biblioteca de fora (v220). Carregada só quando alguém pede um Excel.
 *   Planilha.xlsx(abas) -> Blob
 *   aba = { nome, cols: [larguras], linhas: [[célula, ...], ...], mesclar: ['A1:D1'], congelar: 'A2', filtro: 'A1:L9', paisagem: true }
 *   célula = null | texto | número | { v: valor, f: 'fórmula sem =', e: estilo }   (a fórmula leva o valor já calculado em v)
 * Estilos (E.*) fixos, em Arial. O .zip vai sem compressão, como o das fotos da galeria.
 */
(function () {
  'use strict';
  var E = {
    normal: 0, titulo: 1, sub: 2, cab: 3, txt: 4, qtd: 5, rs: 6, centro: 7, grupo: 8, totTxt: 9, totRs: 10, pct: 11,
    sCab: 12, sTxt: 13, sCentro: 14, sQtd: 15, sTitulo: 16, tot: 17, rsB: 18, qtdB: 19, ordinal: 20, totQtd: 21, txtQ: 22
  };
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="5"><numFmt numFmtId="164" formatCode="#,##0.00#;-#,##0.00#;&quot;–&quot;"/>' +
    '<numFmt numFmtId="165" formatCode="&quot;R$&quot; #,##0.00;-&quot;R$&quot; #,##0.00;&quot;–&quot;"/>' +
    '<numFmt numFmtId="166" formatCode="0.0%"/><numFmt numFmtId="167" formatCode="#,##0.000"/><numFmt numFmtId="168" formatCode="0&quot;ª&quot;"/></numFmts>' +
    '<fonts count="7"><font><sz val="10"/><name val="Arial"/></font>' +
    '<font><b/><sz val="14"/><color rgb="FF1E4E8C"/><name val="Arial"/></font>' +
    '<font><sz val="10"/><color rgb="FF5B6670"/><name val="Arial"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>' +
    '<font><b/><sz val="10"/><name val="Arial"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FF1E4E8C"/><name val="Arial"/></font>' +
    '<font><b/><sz val="11"/><name val="Arial"/></font></fonts>' +
    '<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1E4E8C"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF6"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F4F3"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF3F8"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="4"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FFC9D0CC"/></bottom><diagonal/></border>' +
    '<border><left/><right/><top style="thin"><color rgb="FF5B6670"/></top><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFBFC6CC"/></left><right style="thin"><color rgb="FFBFC6CC"/></right><top style="thin"><color rgb="FFBFC6CC"/></top><bottom style="thin"><color rgb="FFBFC6CC"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="23">' +
    [
      [0, 0, 0, 0, ''],                                                     // normal
      [0, 1, 0, 0, ''],                                                     // titulo
      [0, 2, 0, 0, ''],                                                     // sub
      [0, 3, 2, 0, '<alignment horizontal="center" vertical="center" wrapText="1"/>'],   // cab
      [0, 0, 0, 1, '<alignment vertical="center"/>'],                       // txt
      [164, 0, 0, 1, '<alignment vertical="center"/>'],                     // qtd
      [165, 0, 0, 1, '<alignment vertical="center"/>'],                     // rs
      [0, 0, 0, 1, '<alignment horizontal="center" vertical="center"/>'],   // centro
      [0, 5, 3, 0, ''],                                                     // grupo
      [0, 4, 4, 2, ''],                                                     // totTxt
      [165, 4, 4, 2, ''],                                                   // totRs
      [166, 0, 0, 1, '<alignment vertical="center"/>'],                     // pct
      [0, 4, 5, 3, '<alignment horizontal="center" vertical="center"/>'],   // sCab
      [0, 0, 0, 3, '<alignment vertical="center" wrapText="1"/>'],          // sTxt
      [0, 0, 0, 3, '<alignment horizontal="center" vertical="center"/>'],   // sCentro
      [167, 0, 0, 3, '<alignment vertical="center"/>'],                     // sQtd
      [0, 6, 0, 0, ''],                                                     // sTitulo
      [0, 0, 4, 2, ''],                                                     // tot
      [165, 4, 0, 1, '<alignment vertical="center"/>'],                     // rsB
      [164, 4, 0, 1, '<alignment vertical="center"/>'],                     // qtdB
      [168, 0, 0, 1, '<alignment horizontal="center" vertical="center"/>'], // ordinal
      [164, 4, 4, 2, ''],                                                   // totQtd
      [0, 0, 0, 1, '<alignment vertical="center" wrapText="1"/>']           // txtQ: texto que quebra a linha (nomes longos)
    ].map(function (x) {
      return '<xf numFmtId="' + x[0] + '" fontId="' + x[1] + '" fillId="' + x[2] + '" borderId="' + x[3] + '" xfId="0"' +
        (x[0] ? ' applyNumberFormat="1"' : '') + (x[1] ? ' applyFont="1"' : '') + (x[2] ? ' applyFill="1"' : '') + (x[3] ? ' applyBorder="1"' : '') +
        (x[4] ? ' applyAlignment="1">' + x[4] + '</xf>' : '/>');
    }).join('') + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function xml(s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function col(i) { var s = ''; i++; while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
  function nomeAba(n) { return String(n || 'Planilha').replace(/[\[\]:*?\/\\]/g, ' ').replace(/^'+|'+$/g, '').slice(0, 31) || 'Planilha'; }

  function celula(ref, c) {
    if (c == null || c === '') return '';
    var o = typeof c === 'object' ? c : { v: c }, s = o.e ? ' s="' + o.e + '"' : '', v = o.v;
    if (o.f) {
      var num = typeof v === 'number' && isFinite(v);
      return '<c r="' + ref + '"' + s + (num ? '' : ' t="str"') + '><f>' + xml(o.f) + '</f>' + (v == null ? '' : '<v>' + xml(num ? v : String(v)) + '</v>') + '</c>';
    }
    if (v == null || v === '') return o.e ? '<c r="' + ref + '"' + s + '/>' : '';
    if (typeof v === 'number') return isFinite(v) ? '<c r="' + ref + '"' + s + '><v>' + v + '</v></c>' : '';
    return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + xml(v) + '</t></is></c>';
  }
  function folha(a) {
    var h = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"' + (a.ativa ? ' tabSelected="1"' : '') + '>';
    if (a.congelar) {
      var m = /^([A-Z]+)(\d+)$/.exec(a.congelar), cx = 0;
      for (var i = 0; i < m[1].length; i++) cx = cx * 26 + m[1].charCodeAt(i) - 64;
      var xs = cx - 1, ys = Number(m[2]) - 1, pane = xs && ys ? 'bottomRight' : ys ? 'bottomLeft' : 'topRight';
      h += '<pane' + (xs ? ' xSplit="' + xs + '"' : '') + (ys ? ' ySplit="' + ys + '"' : '') + ' topLeftCell="' + a.congelar + '" activePane="' + pane + '" state="frozen"/>';
    }
    h += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="13.2"/>';
    if (a.cols && a.cols.length) h += '<cols>' + a.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    h += '<sheetData>' + a.linhas.map(function (l, r) {
      var cs = (l || []).map(function (c, j) { return celula(col(j) + (r + 1), c); }).join('');
      return cs ? '<row r="' + (r + 1) + '">' + cs + '</row>' : '';
    }).join('') + '</sheetData>';
    if (a.filtro) h += '<autoFilter ref="' + a.filtro + '"/>';
    if (a.mesclar && a.mesclar.length) h += '<mergeCells count="' + a.mesclar.length + '">' + a.mesclar.map(function (x) { return '<mergeCell ref="' + x + '"/>'; }).join('') + '</mergeCells>';
    return h + '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="' + (a.paisagem ? 'landscape' : 'portrait') + '" fitToWidth="1" fitToHeight="0"/></worksheet>';
  }

  var CRC_T = null;
  function crc32(u8) {
    if (!CRC_T) {
      CRC_T = new Uint32Array(256);
      for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; }
    }
    var r = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) r = CRC_T[(r ^ u8[i]) & 0xFF] ^ (r >>> 8);
    return (r ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(arqs) {   // [[nome, texto]] -> Blob, sem compressão
    var enc = new TextEncoder(), parts = [], central = [], off = 0, d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var day = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    arqs.forEach(function (a) {
      var nm = enc.encode(a[0]), buf = enc.encode(a[1]), crc = crc32(buf), lh = new DataView(new ArrayBuffer(30)), ch = new DataView(new ArrayBuffer(46));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, time, true); lh.setUint16(12, day, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, buf.length, true); lh.setUint32(22, buf.length, true); lh.setUint16(26, nm.length, true);
      parts.push(lh.buffer, nm, buf);
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, time, true); ch.setUint16(14, day, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, buf.length, true); ch.setUint32(24, buf.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(ch.buffer, nm);
      off += 30 + nm.length + buf.length;
    });
    var cd = central.reduce(function (s, x) { return s + x.byteLength; }, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, arqs.length, true); end.setUint16(10, arqs.length, true); end.setUint32(12, cd, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // nomes finais das abas: sem caractere proibido, até 31 letras e sem repetir (pode ser chamado antes, para fazer links)
  function nomes(abas) {
    var usados = {};
    abas.forEach(function (a, i) {
      var n = nomeAba(a.nome), b = n, k = 2;
      while (usados[n.toLowerCase()]) n = b.slice(0, 28) + ' ' + k++;
      usados[n.toLowerCase()] = 1; a.nome = n; a.ativa = i === 0;
    });
    return abas;
  }
  // link para outra aba (fórmula HYPERLINK, com o texto já calculado)
  function link(aba, txt) {
    var t = txt == null ? aba : txt;
    return { f: 'HYPERLINK("#\'' + String(aba).replace(/'/g, "''") + '\'!A1","' + String(t).replace(/"/g, '""') + '")', v: String(t) };
  }
  function xlsx(abas) {
    nomes(abas);
    var arqs = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        abas.map(function (a, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView activeTab="0"/></bookViews><sheets>' + abas.map(function (a, i) { return '<sheet name="' + xml(a.nome) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets>' +
        (abas.some(function (a) { return a.filtro; }) ? '<definedNames>' + abas.map(function (a, i) {
          return a.filtro ? '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + xml(a.nome.replace(/'/g, "''")) + '\'!' + a.filtro.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2') + '</definedName>' : '';
        }).join('') + '</definedNames>' : '') +
        '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        abas.map(function (a, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId' + (abas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', STYLES]
    ];
    abas.forEach(function (a, i) { arqs.push(['xl/worksheets/sheet' + (i + 1) + '.xml', folha(a)]); });
    return zip(arqs);
  }

  window.Planilha = { xlsx: xlsx, E: E, col: col, nomeAba: nomeAba, nomes: nomes, link: link };
})();
