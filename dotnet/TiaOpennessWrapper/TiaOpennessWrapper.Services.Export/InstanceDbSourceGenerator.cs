using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Xml.Linq;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.ExternalSources;

namespace TiaOpennessWrapper.Services.Export;

public static class InstanceDbSourceGenerator
{
	public static void CleanIdbSourceCache(string? basePath)
	{
		if (string.IsNullOrEmpty(basePath))
		{
			return;
		}
		string path = Path.Combine(FindExportRoot(basePath), ".tia-cache", "idb-source");
		if (!Directory.Exists(path))
		{
			return;
		}
		try
		{
			Directory.Delete(path, recursive: true);
		}
		catch
		{
		}
	}

	public static List<(string Path, string Value)> ExtractStartValuesFromXml(string xmlFilePath)
	{
		List<(string, string)> result = new List<(string, string)>();
		try
		{
			XElement xElement = XDocument.Load(xmlFilePath).Descendants().FirstOrDefault((XElement e) => e.Name.LocalName == "Interface");
			if (xElement == null)
			{
				return result;
			}
			XElement xElement2 = xElement.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "Sections");
			if (xElement2 == null)
			{
				return result;
			}
			foreach (XElement item in from e in xElement2.Elements()
				where e.Name.LocalName == "Section"
				select e)
			{
				string text = item.Attribute("Name")?.Value;
				if (text != "Static" && text != "Input" && text != "InOut")
				{
					continue;
				}
				foreach (XElement item2 in from e in item.Elements()
					where e.Name.LocalName == "Member"
					select e)
				{
					CollectStartValues(item2, "", result);
				}
			}
		}
		catch
		{
		}
		return result;
	}

	public static void ApplyStartValues(PlcSoftware plcSoftware, string blockName, string instanceOfName, List<(string Path, string Value)> startValues, string? basePath = null)
	{
		StringBuilder stringBuilder = new StringBuilder();
		stringBuilder.AppendLine("DATA_BLOCK \"" + blockName + "\"");
		stringBuilder.AppendLine("{ S7_Optimized_Access := 'TRUE' }");
		stringBuilder.AppendLine("NON_RETAIN");
		stringBuilder.AppendLine("\"" + instanceOfName + "\"");
		stringBuilder.AppendLine();
		stringBuilder.AppendLine("BEGIN");
		foreach (var (text, text2) in startValues)
		{
			stringBuilder.AppendLine("   " + text + " := " + text2 + ";");
		}
		stringBuilder.AppendLine();
		stringBuilder.AppendLine("END_DATA_BLOCK");
		string text3;
		if (!string.IsNullOrEmpty(basePath))
		{
			text3 = Path.Combine(FindExportRoot(basePath), ".tia-cache", "idb-source");
			Directory.CreateDirectory(text3);
		}
		else
		{
			text3 = Path.Combine(Path.GetTempPath(), "TiaIDB_" + Guid.NewGuid().ToString("N"));
			Directory.CreateDirectory(text3);
		}
		string text4 = Path.Combine(text3, blockName + ".db");
		File.WriteAllText(text4, stringBuilder.ToString(), Encoding.UTF8);
		PlcExternalSourceComposition externalSources = ((PlcExternalSourceGroup)plcSoftware.ExternalSourceGroup).ExternalSources;
		PlcExternalSource val = externalSources.Find(blockName);
		if (val != null)
		{
			val.Delete();
		}
		PlcExternalSource val2 = externalSources.CreateFromFile(blockName, text4);
		val2.GenerateBlocksFromSource((GenerateBlockOption)1);
		try
		{
			val2.Delete();
		}
		catch
		{
		}
	}

	internal static string FindExportRoot(string basePath)
	{
		string text = basePath;
		while (!string.IsNullOrEmpty(text))
		{
			if (Directory.Exists(Path.Combine(text, ".tia-cache")))
			{
				return text;
			}
			string directoryName = Path.GetDirectoryName(text);
			if (directoryName == null || directoryName == text)
			{
				break;
			}
			text = directoryName;
		}
		return Path.GetDirectoryName(basePath) ?? basePath;
	}

	private static void CollectStartValues(XElement member, string parentPath, List<(string Path, string Value)> result)
	{
		string text = member.Attribute("Name")?.Value;
		if (string.IsNullOrEmpty(text))
		{
			return;
		}
		string text2 = (string.IsNullOrEmpty(parentPath) ? text : (parentPath + "." + text));
		XElement xElement = member.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "StartValue");
		if (xElement != null)
		{
			string value = xElement.Value;
			if (!string.IsNullOrEmpty(value))
			{
				result.Add((text2, value));
			}
		}
		foreach (XElement item in from e in member.Elements()
			where e.Name.LocalName == "Subelement"
			select e)
		{
			string text3 = item.Attribute("Path")?.Value;
			if (!string.IsNullOrEmpty(text3))
			{
				XElement xElement2 = item.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "StartValue");
				if (xElement2 != null && !string.IsNullOrEmpty(xElement2.Value))
				{
					result.Add((text2 + "[" + text3 + "]", xElement2.Value));
				}
			}
		}
		foreach (XElement item2 in from e in member.Elements()
			where e.Name.LocalName == "Member"
			select e)
		{
			CollectStartValues(item2, text2, result);
		}
		foreach (XElement item3 in from e in member.Elements()
			where e.Name.LocalName == "Sections"
			select e)
		{
			foreach (XElement item4 in from e in item3.Elements()
				where e.Name.LocalName == "Section"
				select e)
			{
				foreach (XElement item5 in from e in item4.Elements()
					where e.Name.LocalName == "Member"
					select e)
				{
					CollectStartValues(item5, text2, result);
				}
			}
		}
	}
}
