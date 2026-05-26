using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using ClosedXML.Excel;

namespace TiaOpennessWrapper.Services;

public static class TagTableXlsxToXmlConverter
{
	private class TagEntry
	{
		public string Name { get; set; } = "";

		public string DataType { get; set; } = "";

		public string LogicalAddress { get; set; } = "";

		public string Comment { get; set; } = "";

		public string ExternalAccessible { get; set; } = "";

		public string ExternalVisible { get; set; } = "";

		public string ExternalWritable { get; set; } = "";

		public string Retain { get; set; } = "";
	}

	private class ConstantEntry
	{
		public string Name { get; set; } = "";

		public string DataType { get; set; } = "";

		public string Value { get; set; } = "";

		public string Comment { get; set; } = "";
	}

	public static string? ConvertToXml(string xlsxFilePath, string? outputXmlPath = null, List<string>? errors = null)
	{
		if (!File.Exists(xlsxFilePath))
		{
			errors?.Add("File not found: " + xlsxFilePath);
			return null;
		}
		string text = outputXmlPath ?? Path.ChangeExtension(xlsxFilePath, ".xml");
		try
		{
			using XLWorkbook xLWorkbook = new XLWorkbook(xlsxFilePath);
			IXLWorksheet iXLWorksheet = xLWorkbook.Worksheets.FirstOrDefault((IXLWorksheet ws) => ws.Name.Equals("Tags", StringComparison.OrdinalIgnoreCase));
			if (iXLWorksheet == null)
			{
				errors?.Add("No 'Tags' sheet found in: " + Path.GetFileName(xlsxFilePath));
				return null;
			}
			string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(xlsxFilePath);
			List<TagEntry> tags = ReadTagsFromSheet(iXLWorksheet, errors);
			List<ConstantEntry> constants = new List<ConstantEntry>();
			IXLWorksheet iXLWorksheet2 = xLWorkbook.Worksheets.FirstOrDefault((IXLWorksheet ws) => ws.Name.Equals("Constants", StringComparison.OrdinalIgnoreCase));
			if (iXLWorksheet2 != null)
			{
				constants = ReadConstantsFromSheet(iXLWorksheet2, errors);
			}
			string contents = GenerateSimaticMlXml(fileNameWithoutExtension, tags, constants);
			File.WriteAllText(text, contents, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
			return text;
		}
		catch (Exception ex)
		{
			errors?.Add("Exception converting " + Path.GetFileName(xlsxFilePath) + ": " + ex.GetType().Name + ": " + ex.Message);
			return null;
		}
	}

	public static int ConvertDirectoryToXml(string directoryPath, List<string>? errors = null)
	{
		if (!Directory.Exists(directoryPath))
		{
			errors?.Add("Directory not found: " + directoryPath);
			return 0;
		}
		int num = 0;
		string[] files = Directory.GetFiles(directoryPath, "*.xlsx", SearchOption.AllDirectories);
		foreach (string xlsxFilePath in files)
		{
			if (IsTagTableXlsx(xlsxFilePath) && ConvertToXml(xlsxFilePath, null, errors) != null)
			{
				num++;
			}
		}
		return num;
	}

	private static bool IsTagTableXlsx(string xlsxFilePath)
	{
		try
		{
			using XLWorkbook xLWorkbook = new XLWorkbook(xlsxFilePath);
			return xLWorkbook.Worksheets.Any((IXLWorksheet ws) => ws.Name.Equals("Tags", StringComparison.OrdinalIgnoreCase));
		}
		catch
		{
			return false;
		}
	}

	private static List<TagEntry> ReadTagsFromSheet(IXLWorksheet sheet, List<string>? errors)
	{
		List<TagEntry> list = new List<TagEntry>();
		IXLRow iXLRow = sheet.Row(1);
		Dictionary<string, int> dictionary = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
		int num = sheet.LastColumnUsed()?.ColumnNumber() ?? 0;
		for (int i = 1; i <= num; i++)
		{
			string text = iXLRow.Cell(i).GetString().Trim();
			if (!string.IsNullOrEmpty(text))
			{
				dictionary[text] = i;
			}
		}
		if (!dictionary.ContainsKey("Name"))
		{
			errors?.Add("Tags sheet missing required 'Name' column");
			return list;
		}
		int num2 = sheet.LastRowUsed()?.RowNumber() ?? 1;
		for (int j = 2; j <= num2; j++)
		{
			string cellValue = GetCellValue(sheet, j, dictionary, "Name");
			if (!string.IsNullOrWhiteSpace(cellValue))
			{
				list.Add(new TagEntry
				{
					Name = cellValue,
					DataType = GetCellValue(sheet, j, dictionary, "Data Type"),
					LogicalAddress = GetCellValue(sheet, j, dictionary, "Logical Address"),
					Comment = GetCellValue(sheet, j, dictionary, "Comment"),
					Retain = GetCellValue(sheet, j, dictionary, "Retain"),
					ExternalAccessible = GetCellValue(sheet, j, dictionary, "Accessible"),
					ExternalVisible = GetCellValue(sheet, j, dictionary, "Visible"),
					ExternalWritable = GetCellValue(sheet, j, dictionary, "Writable")
				});
			}
		}
		return list;
	}

	private static List<ConstantEntry> ReadConstantsFromSheet(IXLWorksheet sheet, List<string>? errors)
	{
		List<ConstantEntry> list = new List<ConstantEntry>();
		IXLRow iXLRow = sheet.Row(1);
		Dictionary<string, int> dictionary = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
		int num = sheet.LastColumnUsed()?.ColumnNumber() ?? 0;
		for (int i = 1; i <= num; i++)
		{
			string text = iXLRow.Cell(i).GetString().Trim();
			if (!string.IsNullOrEmpty(text))
			{
				dictionary[text] = i;
			}
		}
		if (!dictionary.ContainsKey("Name"))
		{
			errors?.Add("Constants sheet missing required 'Name' column");
			return list;
		}
		int num2 = sheet.LastRowUsed()?.RowNumber() ?? 1;
		for (int j = 2; j <= num2; j++)
		{
			string cellValue = GetCellValue(sheet, j, dictionary, "Name");
			if (!string.IsNullOrWhiteSpace(cellValue))
			{
				list.Add(new ConstantEntry
				{
					Name = cellValue,
					DataType = GetCellValue(sheet, j, dictionary, "Data Type"),
					Value = GetCellValue(sheet, j, dictionary, "Value"),
					Comment = GetCellValue(sheet, j, dictionary, "Comment")
				});
			}
		}
		return list;
	}

	private static string GetCellValue(IXLWorksheet sheet, int row, Dictionary<string, int> columnMap, string columnName)
	{
		if (!columnMap.TryGetValue(columnName, out var value))
		{
			return "";
		}
		return sheet.Cell(row, value).GetString().Trim();
	}

	private static string GenerateSimaticMlXml(string tableName, List<TagEntry> tags, List<ConstantEntry> constants)
	{
		StringBuilder stringBuilder = new StringBuilder();
		int num = 0;
		stringBuilder.AppendLine("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
		stringBuilder.AppendLine("<Document>");
		stringBuilder.AppendLine("  <Engineering version=\"" + TiaConnector.GetInitializedVersionString() + "\" />");
		stringBuilder.AppendLine($"  <SW.Tags.PlcTagTable ID=\"{num++}\">");
		stringBuilder.AppendLine("    <AttributeList>");
		stringBuilder.AppendLine("      <Name>" + EscapeXml(tableName) + "</Name>");
		stringBuilder.AppendLine("    </AttributeList>");
		stringBuilder.AppendLine("    <ObjectList>");
		foreach (TagEntry item in (from g in tags.GroupBy<TagEntry, string>((TagEntry t) => t.Name, StringComparer.OrdinalIgnoreCase)
			select g.Last()).ToList())
		{
			stringBuilder.AppendLine($"      <SW.Tags.PlcTag ID=\"{num++}\" CompositionName=\"Tags\">");
			stringBuilder.AppendLine("        <AttributeList>");
			stringBuilder.AppendLine("          <DataTypeName>" + EscapeXml(item.DataType) + "</DataTypeName>");
			if (!string.IsNullOrEmpty(item.ExternalAccessible))
			{
				stringBuilder.AppendLine("          <ExternalAccessible>" + item.ExternalAccessible.ToLowerInvariant() + "</ExternalAccessible>");
			}
			if (!string.IsNullOrEmpty(item.ExternalVisible))
			{
				stringBuilder.AppendLine("          <ExternalVisible>" + item.ExternalVisible.ToLowerInvariant() + "</ExternalVisible>");
			}
			if (!string.IsNullOrEmpty(item.ExternalWritable))
			{
				stringBuilder.AppendLine("          <ExternalWritable>" + item.ExternalWritable.ToLowerInvariant() + "</ExternalWritable>");
			}
			stringBuilder.AppendLine("          <LogicalAddress>" + EscapeXml(item.LogicalAddress) + "</LogicalAddress>");
			stringBuilder.AppendLine("          <Name>" + EscapeXml(item.Name) + "</Name>");
			if (!string.IsNullOrEmpty(item.Retain) && !item.Retain.Equals("false", StringComparison.OrdinalIgnoreCase))
			{
				stringBuilder.AppendLine("          <Retain>" + EscapeXml(item.Retain) + "</Retain>");
			}
			stringBuilder.AppendLine("        </AttributeList>");
			if (!string.IsNullOrEmpty(item.Comment))
			{
				stringBuilder.AppendLine("        <ObjectList>");
				stringBuilder.AppendLine($"          <MultilingualText ID=\"{num++}\" CompositionName=\"Comment\">");
				stringBuilder.AppendLine("            <ObjectList>");
				stringBuilder.AppendLine($"              <MultilingualTextItem ID=\"{num++}\" CompositionName=\"Items\">");
				stringBuilder.AppendLine("                <AttributeList>");
				stringBuilder.AppendLine("                  <Culture>en-US</Culture>");
				stringBuilder.AppendLine("                  <Text>" + EscapeXml(item.Comment) + "</Text>");
				stringBuilder.AppendLine("                </AttributeList>");
				stringBuilder.AppendLine("              </MultilingualTextItem>");
				stringBuilder.AppendLine("            </ObjectList>");
				stringBuilder.AppendLine("          </MultilingualText>");
				stringBuilder.AppendLine("        </ObjectList>");
			}
			stringBuilder.AppendLine("      </SW.Tags.PlcTag>");
		}
		stringBuilder.AppendLine("    </ObjectList>");
		stringBuilder.AppendLine("  </SW.Tags.PlcTagTable>");
		stringBuilder.AppendLine("</Document>");
		return stringBuilder.ToString();
	}

	private static string EscapeXml(string value)
	{
		if (string.IsNullOrEmpty(value))
		{
			return "";
		}
		return value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
			.Replace("\"", "&quot;")
			.Replace("'", "&apos;");
	}

	public static List<XlsxConstantEntry> ReadConstantsFromXlsx(string xlsxFilePath, List<string>? errors = null)
	{
		List<XlsxConstantEntry> list = new List<XlsxConstantEntry>();
		if (!File.Exists(xlsxFilePath))
		{
			errors?.Add("File not found: " + xlsxFilePath);
			return list;
		}
		try
		{
			using XLWorkbook xLWorkbook = new XLWorkbook(xlsxFilePath);
			IXLWorksheet iXLWorksheet = xLWorkbook.Worksheets.FirstOrDefault((IXLWorksheet ws) => ws.Name.Equals("Constants", StringComparison.OrdinalIgnoreCase));
			if (iXLWorksheet == null)
			{
				return list;
			}
			foreach (ConstantEntry item in ReadConstantsFromSheet(iXLWorksheet, errors))
			{
				list.Add(new XlsxConstantEntry
				{
					Name = item.Name,
					DataType = item.DataType,
					Value = item.Value,
					Comment = item.Comment
				});
			}
		}
		catch (Exception ex)
		{
			errors?.Add("Exception reading constants from " + Path.GetFileName(xlsxFilePath) + ": " + ex.GetType().Name + ": " + ex.Message);
		}
		return list;
	}
}
