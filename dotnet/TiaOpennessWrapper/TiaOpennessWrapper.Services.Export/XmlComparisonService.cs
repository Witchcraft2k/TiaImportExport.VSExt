using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Xml.Linq;
using Siemens.Engineering;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.Tags;
using Siemens.Engineering.SW.Types;
using Siemens.Engineering.SW.WatchAndForceTables;

namespace TiaOpennessWrapper.Services.Export;

public static class XmlComparisonService
{
	public static void CleanComparisonDebugCache(string? basePath)
	{
		if (string.IsNullOrEmpty(basePath))
		{
			return;
		}
		try
		{
			string path = Path.Combine(InstanceDbSourceGenerator.FindExportRoot(basePath), ".tia-cache", "comparison-debug");
			if (Directory.Exists(path))
			{
				Directory.Delete(path, recursive: true);
			}
		}
		catch
		{
		}
	}

	public static BlockComparisonResult CompareBlockWithXml(PlcBlock existingBlock, string xmlFilePath, string? debugBasePath = null)
	{
		string text = null;
		try
		{
			string text2 = Path.Combine(Path.GetTempPath(), "TiaCompare_" + Guid.NewGuid().ToString("N"));
			Directory.CreateDirectory(text2);
			text = Path.Combine(text2, Path.GetFileName(xmlFilePath));
			FileInfo fileInfo = new FileInfo(text);
			existingBlock.Export(fileInfo, (ExportOptions)1);
			bool num = CompareXmlContent(text, xmlFilePath, debugBasePath);
			CleanupTempFiles(text, text2);
			return (!num) ? BlockComparisonResult.Different : BlockComparisonResult.Same;
		}
		catch (Exception ex)
		{
			CleanupTempFiles(text, (text != null) ? Path.GetDirectoryName(text) : null);
			if (ex.Message.Contains("Inconsistent") || ex.Message.Contains("cannot be exported"))
			{
				return BlockComparisonResult.Different;
			}
			return BlockComparisonResult.ComparisonFailed;
		}
	}

	public static bool CompareXmlContent(string file1, string file2, string? debugBasePath = null)
	{
		try
		{
			XDocument doc = XDocument.Load(file1);
			XDocument doc2 = XDocument.Load(file2);
			XElement xElement = FindMainElement(doc);
			XElement xElement2 = FindMainElement(doc2);
			if (xElement == null || xElement2 == null)
			{
				return false;
			}
			string text = NormalizeBlockXml(xElement);
			string text2 = NormalizeBlockXml(xElement2);
			bool flag = text == text2;
			if (!flag && debugBasePath != null)
			{
				try
				{
					string text3 = Path.Combine(InstanceDbSourceGenerator.FindExportRoot(debugBasePath), ".tia-cache", "comparison-debug");
					Directory.CreateDirectory(text3);
					string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(file2);
					File.WriteAllText(Path.Combine(text3, fileNameWithoutExtension + "_tia.xml"), text);
					File.WriteAllText(Path.Combine(text3, fileNameWithoutExtension + "_workspace.xml"), text2);
				}
				catch
				{
				}
			}
			return flag;
		}
		catch
		{
			return false;
		}
	}

	private static XElement? FindMainElement(XDocument doc)
	{
		XElement xElement = doc.Descendants().FirstOrDefault((XElement e) => e.Name.LocalName.StartsWith("SW.Blocks."));
		if (xElement != null)
		{
			return xElement;
		}
		XElement xElement2 = doc.Descendants().FirstOrDefault((XElement e) => e.Name.LocalName.StartsWith("SW.Types."));
		if (xElement2 != null)
		{
			return xElement2;
		}
		XElement xElement3 = doc.Descendants().FirstOrDefault((XElement e) => e.Name.LocalName.StartsWith("SW.Tags."));
		if (xElement3 != null)
		{
			return xElement3;
		}
		XElement xElement4 = doc.Descendants().FirstOrDefault((XElement e) => e.Name.LocalName.StartsWith("SW.WatchAndForceTables."));
		if (xElement4 != null)
		{
			return xElement4;
		}
		return null;
	}

	public static BlockComparisonResult CompareInstanceDbStartValues(PlcBlock existingBlock, string xmlFilePath, string? debugBasePath = null)
	{
		string text = null;
		string text2 = null;
		try
		{
			text2 = Path.Combine(Path.GetTempPath(), "TiaCompare_" + Guid.NewGuid().ToString("N"));
			Directory.CreateDirectory(text2);
			text = Path.Combine(text2, Path.GetFileName(xmlFilePath));
			FileInfo fileInfo = new FileInfo(text);
			existingBlock.Export(fileInfo, (ExportOptions)1);
			List<(string, string)> list = FilterNonDefaultStartValues(InstanceDbSourceGenerator.ExtractStartValuesFromXml(text));
			List<(string, string)> list2 = FilterNonDefaultStartValues(InstanceDbSourceGenerator.ExtractStartValuesFromXml(xmlFilePath));
			bool flag = list.Count == list2.Count;
			if (flag)
			{
				for (int i = 0; i < list.Count; i++)
				{
					if (!string.Equals(list[i].Item1, list2[i].Item1, StringComparison.OrdinalIgnoreCase) || !string.Equals(list[i].Item2, list2[i].Item2, StringComparison.OrdinalIgnoreCase))
					{
						flag = false;
						break;
					}
				}
			}
			if (!flag && debugBasePath != null)
			{
				try
				{
					string text3 = Path.Combine(InstanceDbSourceGenerator.FindExportRoot(debugBasePath), ".tia-cache", "comparison-debug");
					Directory.CreateDirectory(text3);
					string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(xmlFilePath);
					StringBuilder stringBuilder = new StringBuilder();
					stringBuilder.AppendLine("=== TIA StartValues (non-default) ===");
					foreach (var item in list)
					{
						stringBuilder.AppendLine("  " + item.Item1 + " = " + item.Item2);
					}
					stringBuilder.AppendLine();
					stringBuilder.AppendLine("=== Workspace StartValues (non-default) ===");
					foreach (var item2 in list2)
					{
						stringBuilder.AppendLine("  " + item2.Item1 + " = " + item2.Item2);
					}
					File.WriteAllText(Path.Combine(text3, fileNameWithoutExtension + "_startvalues.txt"), stringBuilder.ToString());
				}
				catch
				{
				}
			}
			CleanupTempFiles(text, text2);
			return (!flag) ? BlockComparisonResult.Different : BlockComparisonResult.Same;
		}
		catch (Exception ex)
		{
			CleanupTempFiles(text, text2);
			if (ex.Message.Contains("Inconsistent") || ex.Message.Contains("cannot be exported"))
			{
				return BlockComparisonResult.Different;
			}
			return BlockComparisonResult.ComparisonFailed;
		}
	}

	private static List<(string Path, string Value)> FilterNonDefaultStartValues(List<(string Path, string Value)> startValues)
	{
		return startValues.Where<(string, string)>(((string Path, string Value) sv) => !IsDefaultStartValue(sv.Value)).OrderBy<(string, string), string>(((string Path, string Value) sv) => sv.Path, StringComparer.OrdinalIgnoreCase).ToList();
	}

	private static bool IsDefaultStartValue(string value)
	{
		if (string.IsNullOrEmpty(value))
		{
			return true;
		}
		if (value.Equals("FALSE", StringComparison.OrdinalIgnoreCase))
		{
			return true;
		}
		if (double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var result) && result == 0.0)
		{
			return true;
		}
		switch (value)
		{
		case "T#0ms":
		case "T#0s":
		case "T#0h":
		case "T#0d":
			return true;
		default:
			return false;
		}
	}

	public static string NormalizeBlockXml(XElement block)
	{
		XElement xElement = new XElement(block);
		StripNamespaces(xElement);
		foreach (XElement item in xElement.DescendantsAndSelf().ToList())
		{
			item.Attribute("ID")?.Remove();
			item.Attribute("Informative")?.Remove();
			foreach (XElement item2 in (from e in item.Elements()
				where e.Name.LocalName == "Created" || e.Name.LocalName == "Modified" || e.Name.LocalName == "DocumentInfo" || e.Name.LocalName == "Engineering" || e.Name.LocalName == "HeaderAuthor" || e.Name.LocalName == "HeaderDate" || e.Name.LocalName == "InterfaceModifiedDate" || e.Name.LocalName == "CodeModifiedDate" || e.Name.LocalName == "ParameterModified" || e.Name.LocalName == "StructureModified"
				select e).ToList())
			{
				item2.Remove();
			}
		}
		return xElement.ToString(SaveOptions.DisableFormatting);
	}

	private static void StripNamespaces(XElement element)
	{
		element.Name = element.Name.LocalName;
		(from a in element.Attributes()
			where a.IsNamespaceDeclaration
			select a).ToList().ForEach(delegate(XAttribute a)
		{
			a.Remove();
		});
		foreach (XElement item in element.Elements().ToList())
		{
			StripNamespaces(item);
		}
	}

	public static string? ExtractBlockNameFromXml(string xmlFilePath)
	{
		try
		{
			XElement xElement = XDocument.Load(xmlFilePath).Descendants().FirstOrDefault((XElement e) => e.Name.LocalName.StartsWith("SW.Blocks."));
			if (xElement != null)
			{
				XElement xElement2 = xElement.Descendants().FirstOrDefault((XElement e) => e.Name.LocalName == "Name" && e.Parent?.Name.LocalName == "AttributeList");
				if (xElement2 != null)
				{
					return xElement2.Value;
				}
			}
			string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(xmlFilePath);
			int num = fileNameWithoutExtension.LastIndexOf('_');
			if (num > 0)
			{
				return fileNameWithoutExtension.Substring(0, num);
			}
			return null;
		}
		catch
		{
			return null;
		}
	}

	public static string? ExtractNameFromXml(string xmlFilePath)
	{
		try
		{
			return FindMainElement(XDocument.Load(xmlFilePath))?.Descendants().FirstOrDefault((XElement e) => e.Name.LocalName == "Name" && e.Parent?.Name.LocalName == "AttributeList")?.Value;
		}
		catch
		{
			return null;
		}
	}

	public static (bool IsInstanceDB, string? InstanceOfName, string? BlockName, int BlockNumber) ExtractInstanceDBInfo(string xmlFilePath)
	{
		try
		{
			XElement xElement = XDocument.Load(xmlFilePath).Descendants().FirstOrDefault((XElement e) => e.Name.LocalName == "SW.Blocks.InstanceDB");
			if (xElement == null)
			{
				return (IsInstanceDB: false, InstanceOfName: null, BlockName: null, BlockNumber: 0);
			}
			XElement xElement2 = xElement.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "AttributeList");
			if (xElement2 == null)
			{
				return (IsInstanceDB: true, InstanceOfName: null, BlockName: null, BlockNumber: 0);
			}
			string item = xElement2.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "InstanceOfName")?.Value;
			string item2 = xElement2.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "Name")?.Value;
			int result = 0;
			XElement xElement3 = xElement2.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "Number");
			if (xElement3 != null)
			{
				int.TryParse(xElement3.Value, out result);
			}
			return (IsInstanceDB: true, InstanceOfName: item, BlockName: item2, BlockNumber: result);
		}
		catch
		{
			return (IsInstanceDB: false, InstanceOfName: null, BlockName: null, BlockNumber: 0);
		}
	}

	public static BlockComparisonResult CompareTagTableWithXml(PlcTagTable existingTable, string xmlFilePath)
	{
		string text = null;
		string text2 = null;
		try
		{
			text2 = Path.Combine(Path.GetTempPath(), "TiaCompare_" + Guid.NewGuid().ToString("N"));
			Directory.CreateDirectory(text2);
			text = Path.Combine(text2, Path.GetFileName(xmlFilePath));
			FileInfo fileInfo = new FileInfo(text);
			existingTable.Export(fileInfo, (ExportOptions)1);
			bool flag = CompareXmlContent(text, xmlFilePath);
			CleanupTempFiles(text, text2);
			return (!flag) ? BlockComparisonResult.Different : BlockComparisonResult.Same;
		}
		catch
		{
			CleanupTempFiles(text, text2);
			return BlockComparisonResult.ComparisonFailed;
		}
	}

	public static BlockComparisonResult CompareUdtWithXml(PlcType existingType, string xmlFilePath)
	{
		string text = null;
		string text2 = null;
		try
		{
			text2 = Path.Combine(Path.GetTempPath(), "TiaCompare_" + Guid.NewGuid().ToString("N"));
			Directory.CreateDirectory(text2);
			text = Path.Combine(text2, Path.GetFileName(xmlFilePath));
			FileInfo fileInfo = new FileInfo(text);
			existingType.Export(fileInfo, (ExportOptions)1);
			bool flag = CompareXmlContent(text, xmlFilePath);
			CleanupTempFiles(text, text2);
			return (!flag) ? BlockComparisonResult.Different : BlockComparisonResult.Same;
		}
		catch
		{
			CleanupTempFiles(text, text2);
			return BlockComparisonResult.ComparisonFailed;
		}
	}

	public static BlockComparisonResult CompareWatchTableWithXml(PlcWatchTable existingTable, string xmlFilePath)
	{
		string text = null;
		string text2 = null;
		try
		{
			text2 = Path.Combine(Path.GetTempPath(), "TiaCompare_" + Guid.NewGuid().ToString("N"));
			Directory.CreateDirectory(text2);
			text = Path.Combine(text2, Path.GetFileName(xmlFilePath));
			FileInfo fileInfo = new FileInfo(text);
			existingTable.Export(fileInfo, (ExportOptions)1);
			bool flag = CompareXmlContent(text, xmlFilePath);
			CleanupTempFiles(text, text2);
			return (!flag) ? BlockComparisonResult.Different : BlockComparisonResult.Same;
		}
		catch
		{
			CleanupTempFiles(text, text2);
			return BlockComparisonResult.ComparisonFailed;
		}
	}

	private static void CleanupTempFiles(string? tempFilePath, string? tempDir)
	{
		try
		{
			if (tempFilePath != null && File.Exists(tempFilePath))
			{
				File.Delete(tempFilePath);
			}
			if (tempDir != null && Directory.Exists(tempDir))
			{
				Directory.Delete(tempDir, recursive: true);
			}
		}
		catch
		{
		}
	}
}
