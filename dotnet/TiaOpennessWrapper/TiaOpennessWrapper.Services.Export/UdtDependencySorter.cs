using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace TiaOpennessWrapper.Services.Export;

public static class UdtDependencySorter
{
	private class UdtFileInfo
	{
		public string FilePath { get; set; } = "";

		public string TypeName { get; set; } = "";

		public HashSet<string> Dependencies { get; set; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
	}

	private static readonly HashSet<string> BuiltInTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
	{
		"Bool", "Byte", "Word", "DWord", "LWord", "SInt", "Int", "DInt", "LInt", "USInt",
		"UInt", "UDInt", "ULInt", "Real", "LReal", "Char", "WChar", "S5Time", "Time", "LTime",
		"Date", "LDate", "Time_Of_Day", "TOD", "LTime_Of_Day", "LTOD", "Date_And_Time", "DT", "LDT", "DTL",
		"Timer", "Counter", "Void", "String", "WString", "Any", "Pointer", "IEC_TIMER", "IEC_COUNTER", "IEC_SCOUNTER",
		"IEC_DCOUNTER", "IEC_UCOUNTER", "IEC_UDCOUNTER", "IEC_LTIMER", "TON_TIME", "TOF_TIME", "TP_TIME", "TONR_TIME", "TON_LTIME", "TOF_LTIME",
		"TP_LTIME", "TONR_LTIME", "CTU", "CTD", "CTUD", "CTU_DINT", "CTD_DINT", "CTUD_DINT", "CTU_UDINT", "CTD_UDINT",
		"CTUD_UDINT", "CTU_LINT", "CTD_LINT", "CTUD_LINT", "CTU_ULINT", "CTD_ULINT", "CTUD_ULINT", "HW_ANY", "HW_DEVICE", "HW_DPMASTER",
		"HW_DPSLAVE", "HW_IO", "HW_IOSYSTEM", "HW_SUBMODULE", "HW_MODULE", "HW_INTERFACE", "HW_HSC", "HW_PWM", "Hw_Io", "Hw_SubModule",
		"Hw_Module", "Hw_Interface", "Hw_Device", "HW_PTO", "EVENT_ANY", "EVENT_ATT", "EVENT_HWINT", "PORT", "RTM", "PIP",
		"OB_ANY", "OB_DELAY", "OB_TOD", "OB_CYCLIC", "OB_ATT", "OB_PCYCLE", "OB_HWINT", "OB_DIAG", "OB_TIMEERROR", "OB_STARTUP",
		"CONN_ANY", "CONN_PRG", "CONN_OUC", "CONN_R_ID", "DB_ANY", "DB_WWW", "DB_DYN", "Variant", "ErrorStruct", "NREF",
		"CREF", "EVENT_TASK"
	};

	private static readonly Regex QuotedTypeRegex = new Regex("\"([^\"]+)\"", RegexOptions.Compiled);

	public static List<string> SortByDependencies(List<string> udtFiles)
	{
		if (udtFiles.Count <= 1)
		{
			return new List<string>(udtFiles);
		}
		Dictionary<string, UdtFileInfo> udtInfos = new Dictionary<string, UdtFileInfo>(StringComparer.OrdinalIgnoreCase);
		Dictionary<string, string> dictionary = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
		foreach (string udtFile in udtFiles)
		{
			UdtFileInfo udtFileInfo = ParseUdtFile(udtFile);
			if (udtFileInfo != null && !string.IsNullOrEmpty(udtFileInfo.TypeName))
			{
				udtInfos[udtFileInfo.TypeName] = udtFileInfo;
				dictionary[udtFileInfo.TypeName] = udtFile;
			}
		}
		Dictionary<string, HashSet<string>> dictionary2 = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
		Dictionary<string, int> dictionary3 = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
		foreach (string key2 in udtInfos.Keys)
		{
			if (!dictionary2.ContainsKey(key2))
			{
				dictionary2[key2] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
			}
			if (!dictionary3.ContainsKey(key2))
			{
				dictionary3[key2] = 0;
			}
		}
		foreach (KeyValuePair<string, UdtFileInfo> item in udtInfos)
		{
			string key = item.Key;
			foreach (string dependency in item.Value.Dependencies)
			{
				if (!udtInfos.ContainsKey(dependency) || string.Equals(dependency, key, StringComparison.OrdinalIgnoreCase))
				{
					continue;
				}
				if (!dictionary2.ContainsKey(dependency))
				{
					dictionary2[dependency] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
				}
				if (dictionary2[dependency].Add(key))
				{
					if (!dictionary3.ContainsKey(key))
					{
						dictionary3[key] = 0;
					}
					dictionary3[key]++;
				}
			}
		}
		Queue<string> queue = new Queue<string>();
		foreach (KeyValuePair<string, int> item2 in dictionary3)
		{
			if (item2.Value == 0)
			{
				queue.Enqueue(item2.Key);
			}
		}
		List<string> sortedNames = new List<string>();
		while (queue.Count > 0)
		{
			string text = queue.Dequeue();
			sortedNames.Add(text);
			if (!dictionary2.ContainsKey(text))
			{
				continue;
			}
			foreach (string item3 in dictionary2[text])
			{
				dictionary3[item3]--;
				if (dictionary3[item3] == 0)
				{
					queue.Enqueue(item3);
				}
			}
		}
		List<string> remainingNames = udtInfos.Keys.Where((string n) => !sortedNames.Contains<string>(n, StringComparer.OrdinalIgnoreCase)).ToList();
		if (remainingNames.Count > 0)
		{
			List<string> collection = (from f in udtFiles
				select udtInfos.Values.FirstOrDefault((UdtFileInfo i) => i.FilePath == f)?.TypeName into n
				where n != null && remainingNames.Contains(n, StringComparer.OrdinalIgnoreCase)
				select n).ToList();
			sortedNames.AddRange(collection);
		}
		List<string> list = new List<string>();
		HashSet<string> hashSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
		foreach (string item4 in sortedNames)
		{
			if (dictionary.TryGetValue(item4, out var value) && hashSet.Add(value))
			{
				list.Add(value);
			}
		}
		foreach (string udtFile2 in udtFiles)
		{
			if (hashSet.Add(udtFile2))
			{
				list.Add(udtFile2);
			}
		}
		return list;
	}

	private static UdtFileInfo? ParseUdtFile(string filePath)
	{
		try
		{
			XElement root = XDocument.Load(filePath).Root;
			if (root == null)
			{
				return null;
			}
			XElement xElement = root.Descendants().FirstOrDefault((XElement e) => e.Name.LocalName.StartsWith("SW.Types."));
			if (xElement == null)
			{
				return null;
			}
			string typeName = xElement.Descendants().FirstOrDefault((XElement e) => e.Name.LocalName == "Name" && e.Parent?.Name.LocalName == "AttributeList")?.Value ?? Path.GetFileNameWithoutExtension(filePath);
			HashSet<string> dependencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
			foreach (XElement item in from e in xElement.Descendants()
				where e.Name.LocalName == "Member"
				select e)
			{
				string text = item.Attribute("Datatype")?.Value;
				if (!string.IsNullOrEmpty(text))
				{
					ExtractReferencedTypes(text, dependencies);
				}
			}
			return new UdtFileInfo
			{
				FilePath = filePath,
				TypeName = typeName,
				Dependencies = dependencies
			};
		}
		catch
		{
			return null;
		}
	}

	private static void ExtractReferencedTypes(string datatype, HashSet<string> dependencies)
	{
		foreach (Match item in QuotedTypeRegex.Matches(datatype))
		{
			string text = item.Groups[1].Value;
			int num = text.IndexOf(':');
			if (num > 0)
			{
				text = text.Substring(0, num);
			}
			if (!IsBuiltInType(text))
			{
				dependencies.Add(text);
			}
		}
		string text2 = datatype.Trim();
		int num2 = text2.IndexOf(" of ", StringComparison.OrdinalIgnoreCase);
		if (num2 >= 0)
		{
			text2 = text2.Substring(num2 + 4).Trim();
		}
		if ((!text2.StartsWith("\"") || !text2.EndsWith("\"")) && !IsBuiltInType(text2) && !text2.Contains("[") && !text2.Contains("\"") && !text2.Contains(" ") && text2.Length > 0 && Regex.IsMatch(text2, "^[A-Za-z_][A-Za-z0-9_]*$"))
		{
			dependencies.Add(text2);
		}
	}

	private static bool IsBuiltInType(string typeName)
	{
		if (string.IsNullOrEmpty(typeName))
		{
			return true;
		}
		if (BuiltInTypes.Contains(typeName))
		{
			return true;
		}
		int num = typeName.IndexOf('[');
		if (num > 0)
		{
			string item = typeName.Substring(0, num);
			if (BuiltInTypes.Contains(item))
			{
				return true;
			}
		}
		return false;
	}
}
