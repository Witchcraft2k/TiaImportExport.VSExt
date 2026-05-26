using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Xml.Linq;
using ClosedXML.Excel;

namespace TiaOpennessWrapper.Services;

public static class TagTableXlsxConverter
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

	public static string? ConvertToXlsx(string xmlFilePath, List<string>? errors = null)
	{
		if (!File.Exists(xmlFilePath))
		{
			errors?.Add("File not found: " + xmlFilePath);
			return null;
		}
		string text = Path.ChangeExtension(xmlFilePath, ".xlsx");
		try
		{
			XElement xElement = XDocument.Load(xmlFilePath).Descendants().FirstOrDefault((XElement e) => e.Name.LocalName == "SW.Tags.PlcTagTable");
			if (xElement == null)
			{
				errors?.Add("No SW.Tags.PlcTagTable element found in: " + Path.GetFileName(xmlFilePath));
				return null;
			}
			string tableName = GetAttributeValue(xElement, "Name") ?? Path.GetFileNameWithoutExtension(xmlFilePath);
			List<TagEntry> tags = ParseTags(xElement);
			List<ConstantEntry> constants = ParseConstants(xElement);
			using (XLWorkbook xLWorkbook = new XLWorkbook())
			{
				CreateTagsSheet(xLWorkbook, tableName, tags);
				CreateConstantsSheet(xLWorkbook, constants);
				xLWorkbook.SaveAs(text);
			}
			return text;
		}
		catch (Exception ex)
		{
			errors?.Add("Exception converting " + Path.GetFileName(xmlFilePath) + ": " + ex.GetType().Name + ": " + ex.Message);
			return null;
		}
	}

	public static int ConvertDirectoryToXlsx(string directoryPath, List<string>? errors = null, bool deleteXmlAfterConversion = false)
	{
		if (!Directory.Exists(directoryPath))
		{
			errors?.Add("Directory not found: " + directoryPath);
			return 0;
		}
		string[] files = Directory.GetFiles(directoryPath, "*.xml", SearchOption.AllDirectories);
		errors?.Add($"Found {files.Length} XML file(s) in {directoryPath}");
		int num = 0;
		string[] array = files;
		foreach (string text in array)
		{
			if (!IsTagTableXml(text))
			{
				errors?.Add("Skipped (not tag table): " + Path.GetFileName(text));
			}
			else
			{
				if (ConvertToXlsx(text, errors) == null)
				{
					continue;
				}
				num++;
				if (deleteXmlAfterConversion)
				{
					try
					{
						File.Delete(text);
					}
					catch
					{
					}
				}
			}
		}
		return num;
	}

	private static bool IsTagTableXml(string xmlFilePath)
	{
		try
		{
			using (StreamReader streamReader = new StreamReader(xmlFilePath))
			{
				for (int i = 0; i < 60; i++)
				{
					string text = streamReader.ReadLine();
					if (text != null)
					{
						if (text.Contains("SW.Tags.PlcTagTable"))
						{
							return true;
						}
						continue;
					}
					break;
				}
			}
			return false;
		}
		catch
		{
			return false;
		}
	}

	private static List<TagEntry> ParseTags(XElement tagTableElement)
	{
		List<TagEntry> list = new List<TagEntry>();
		XElement xElement = tagTableElement.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "ObjectList");
		if (xElement == null)
		{
			return list;
		}
		foreach (XElement item in from e in xElement.Elements()
			where e.Name.LocalName == "SW.Tags.PlcTag"
			select e)
		{
			TagEntry tagEntry = new TagEntry
			{
				Name = (GetAttributeValue(item, "Name") ?? ""),
				DataType = (GetAttributeValue(item, "DataTypeName") ?? ""),
				LogicalAddress = (GetAttributeValue(item, "LogicalAddress") ?? ""),
				Comment = GetCommentText(item),
				ExternalAccessible = (GetAttributeValue(item, "ExternalAccessible") ?? ""),
				ExternalVisible = (GetAttributeValue(item, "ExternalVisible") ?? ""),
				ExternalWritable = (GetAttributeValue(item, "ExternalWritable") ?? ""),
				Retain = (GetAttributeValue(item, "Retain") ?? "")
			};
			if (!string.IsNullOrEmpty(tagEntry.Name))
			{
				list.Add(tagEntry);
			}
		}
		return list;
	}

	private static List<ConstantEntry> ParseConstants(XElement tagTableElement)
	{
		List<ConstantEntry> list = new List<ConstantEntry>();
		XElement xElement = tagTableElement.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "ObjectList");
		if (xElement == null)
		{
			return list;
		}
		foreach (XElement item in from e in xElement.Elements()
			where e.Name.LocalName == "SW.Tags.PlcUserConstant"
			select e)
		{
			ConstantEntry constantEntry = new ConstantEntry
			{
				Name = (GetAttributeValue(item, "Name") ?? ""),
				DataType = (GetAttributeValue(item, "DataTypeName") ?? ""),
				Value = (GetAttributeValue(item, "Value") ?? ""),
				Comment = GetCommentText(item)
			};
			if (!string.IsNullOrEmpty(constantEntry.Name))
			{
				list.Add(constantEntry);
			}
		}
		return list;
	}

	private static string GetAttributeValue(XElement element, string attributeName)
	{
		XElement xElement = element.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "AttributeList");
		if (xElement == null)
		{
			return "";
		}
		return xElement.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == attributeName)?.Value?.Trim() ?? "";
	}

	private static string GetCommentText(XElement element)
	{
		try
		{
			XElement xElement = element.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "ObjectList");
			if (xElement == null)
			{
				return "";
			}
			XElement xElement2 = xElement.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "MultilingualText" && e.Attribute("CompositionName")?.Value == "Comment");
			if (xElement2 == null)
			{
				return "";
			}
			foreach (XElement item in from e in xElement2.Descendants()
				where e.Name.LocalName == "MultilingualTextItem"
				select e)
			{
				XElement xElement3 = item.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "AttributeList");
				if (xElement3 != null)
				{
					XElement xElement4 = xElement3.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "Text");
					if (xElement4 != null && !string.IsNullOrWhiteSpace(xElement4.Value))
					{
						return xElement4.Value.Trim();
					}
				}
			}
		}
		catch
		{
		}
		return "";
	}

	private static void CreateTagsSheet(XLWorkbook workbook, string tableName, List<TagEntry> tags)
	{
		IXLWorksheet iXLWorksheet = workbook.Worksheets.Add("Tags");
		string[] array = new string[8] { "Name", "Data Type", "Logical Address", "Comment", "Retain", "Accessible", "Visible", "Writable" };
		for (int i = 0; i < array.Length; i++)
		{
			IXLCell iXLCell = iXLWorksheet.Cell(1, i + 1);
			iXLCell.Value = array[i];
			iXLCell.Style.Font.Bold = true;
			iXLCell.Style.Fill.BackgroundColor = XLColor.FromArgb(0, 108, 150);
			iXLCell.Style.Font.FontColor = XLColor.White;
			iXLCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
		}
		for (int j = 0; j < tags.Count; j++)
		{
			TagEntry tagEntry = tags[j];
			iXLWorksheet.Cell(j + 2, 1).Value = tagEntry.Name;
			iXLWorksheet.Cell(j + 2, 2).Value = tagEntry.DataType;
			iXLWorksheet.Cell(j + 2, 3).Value = tagEntry.LogicalAddress;
			iXLWorksheet.Cell(j + 2, 4).Value = tagEntry.Comment;
			iXLWorksheet.Cell(j + 2, 5).Value = tagEntry.Retain;
			iXLWorksheet.Cell(j + 2, 6).Value = tagEntry.ExternalAccessible;
			iXLWorksheet.Cell(j + 2, 7).Value = tagEntry.ExternalVisible;
			iXLWorksheet.Cell(j + 2, 8).Value = tagEntry.ExternalWritable;
			if (j % 2 == 1)
			{
				for (int k = 1; k <= array.Length; k++)
				{
					iXLWorksheet.Cell(j + 2, k).Style.Fill.BackgroundColor = XLColor.FromArgb(240, 244, 248);
				}
			}
		}
		iXLWorksheet.Columns().AdjustToContents();
		if (tags.Count > 0)
		{
			iXLWorksheet.RangeUsed()?.SetAutoFilter();
		}
	}

	private static void CreateConstantsSheet(XLWorkbook workbook, List<ConstantEntry> constants)
	{
		IXLWorksheet iXLWorksheet = workbook.Worksheets.Add("Constants");
		string[] array = new string[4] { "Name", "Data Type", "Value", "Comment" };
		for (int i = 0; i < array.Length; i++)
		{
			IXLCell iXLCell = iXLWorksheet.Cell(1, i + 1);
			iXLCell.Value = array[i];
			iXLCell.Style.Font.Bold = true;
			iXLCell.Style.Fill.BackgroundColor = XLColor.FromArgb(0, 108, 150);
			iXLCell.Style.Font.FontColor = XLColor.White;
			iXLCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
		}
		for (int j = 0; j < constants.Count; j++)
		{
			ConstantEntry constantEntry = constants[j];
			iXLWorksheet.Cell(j + 2, 1).Value = constantEntry.Name;
			iXLWorksheet.Cell(j + 2, 2).Value = constantEntry.DataType;
			iXLWorksheet.Cell(j + 2, 3).Value = constantEntry.Value;
			iXLWorksheet.Cell(j + 2, 4).Value = constantEntry.Comment;
			if (j % 2 == 1)
			{
				for (int k = 1; k <= array.Length; k++)
				{
					iXLWorksheet.Cell(j + 2, k).Style.Fill.BackgroundColor = XLColor.FromArgb(240, 244, 248);
				}
			}
		}
		iXLWorksheet.Columns().AdjustToContents();
		if (constants.Count > 0)
		{
			iXLWorksheet.RangeUsed()?.SetAutoFilter();
		}
	}
}
