using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace TiaOpennessWrapper.Services.Export;

public static class BlockDependencySorter
{
	private enum BlockKind
	{
		Fc = 0,
		Fb = 1,
		Ob = 2,
		GlobalDb = 3,
		InstanceDb = 4,
		Unknown = 99
	}

	private class BlockFileInfo
	{
		public string FilePath = string.Empty;

		public string BlockName = string.Empty;

		public BlockKind Kind = BlockKind.Unknown;

		public HashSet<string> Dependencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
	}

	private static readonly HashSet<string> BuiltInNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
	{
		"TON_TIME", "TOF_TIME", "TP_TIME", "TONR_TIME", "TON_LTIME", "TOF_LTIME", "TP_LTIME", "TONR_LTIME", "IEC_TIMER", "IEC_LTIMER",
		"IEC_COUNTER", "IEC_SCOUNTER", "IEC_DCOUNTER", "IEC_UCOUNTER", "IEC_UDCOUNTER", "CTU", "CTD", "CTUD", "CTU_DINT", "CTD_DINT",
		"CTUD_DINT", "CTU_UDINT", "CTD_UDINT", "CTUD_UDINT", "CTU_LINT", "CTD_LINT", "CTUD_LINT", "CTU_ULINT", "CTD_ULINT", "CTUD_ULINT",
		"R_TRIG", "F_TRIG", "ErrorStruct"
	};

	private static readonly Regex QuotedIdentifierRegex = new Regex("\"([A-Za-z_][A-Za-z0-9_]*)\"", RegexOptions.Compiled);

	private static readonly Regex SclLineCommentRegex = new Regex("//[^\\n]*", RegexOptions.Compiled);

	private static readonly Regex SclBlockCommentRegex = new Regex("\\(\\*.*?\\*\\)", RegexOptions.Compiled | RegexOptions.Singleline);

	public static List<string> SortByDependencies(IEnumerable<string> blockFiles)
	{
		List<string> list = blockFiles?.ToList() ?? new List<string>();
		if (list.Count <= 1)
		{
			return new List<string>(list);
		}
		List<BlockFileInfo> list2 = new List<BlockFileInfo>();
		Dictionary<string, BlockFileInfo> dictionary = new Dictionary<string, BlockFileInfo>(StringComparer.OrdinalIgnoreCase);
		Dictionary<string, string> dictionary2 = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
		foreach (string item in list)
		{
			BlockFileInfo blockFileInfo = ParseBlockFile(item);
			if (blockFileInfo != null && !string.IsNullOrEmpty(blockFileInfo.BlockName))
			{
				list2.Add(blockFileInfo);
				dictionary[item] = blockFileInfo;
				if (!dictionary2.ContainsKey(blockFileInfo.BlockName))
				{
					dictionary2[blockFileInfo.BlockName] = item;
				}
			}
		}
		if (list2.Count == 0)
		{
			return new List<string>(list);
		}
		Dictionary<string, HashSet<string>> dictionary3 = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
		Dictionary<string, int> dictionary4 = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
		foreach (BlockFileInfo item2 in list2)
		{
			if (!dictionary3.ContainsKey(item2.BlockName))
			{
				dictionary3[item2.BlockName] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
			}
			if (!dictionary4.ContainsKey(item2.BlockName))
			{
				dictionary4[item2.BlockName] = 0;
			}
		}
		foreach (BlockFileInfo item3 in list2)
		{
			foreach (string dependency in item3.Dependencies)
			{
				if (string.Equals(dependency, item3.BlockName, StringComparison.OrdinalIgnoreCase) || !dictionary2.ContainsKey(dependency))
				{
					continue;
				}
				if (!dictionary3.ContainsKey(dependency))
				{
					dictionary3[dependency] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
				}
				if (dictionary3[dependency].Add(item3.BlockName))
				{
					if (!dictionary4.ContainsKey(item3.BlockName))
					{
						dictionary4[item3.BlockName] = 0;
					}
					dictionary4[item3.BlockName]++;
				}
			}
		}
		Dictionary<string, BlockFileInfo> infoByName = list2.ToDictionary<BlockFileInfo, string, BlockFileInfo>((BlockFileInfo i) => i.BlockName, (BlockFileInfo i) => i, StringComparer.OrdinalIgnoreCase);
		List<string> list3 = new List<string>();
		foreach (KeyValuePair<string, int> item4 in dictionary4)
		{
			if (item4.Value == 0)
			{
				list3.Add(item4.Key);
			}
		}
		list3.Sort(Compare);
		List<string> list4 = new List<string>();
		while (list3.Count > 0)
		{
			string text = list3[0];
			list3.RemoveAt(0);
			list4.Add(text);
			if (!dictionary3.TryGetValue(text, out var value))
			{
				continue;
			}
			foreach (string item5 in value)
			{
				dictionary4[item5]--;
				if (dictionary4[item5] == 0)
				{
					list3.Add(item5);
				}
			}
			if (value.Count > 0)
			{
				list3.Sort(Compare);
			}
		}
		HashSet<string> hashSet = new HashSet<string>(list4, StringComparer.OrdinalIgnoreCase);
		foreach (BlockFileInfo item6 in list2)
		{
			if (hashSet.Add(item6.BlockName))
			{
				list4.Add(item6.BlockName);
			}
		}
		List<string> list5 = new List<string>();
		HashSet<string> hashSet2 = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
		foreach (string item7 in list4)
		{
			if (dictionary2.TryGetValue(item7, out var value2) && hashSet2.Add(value2))
			{
				list5.Add(value2);
			}
		}
		foreach (string item8 in list)
		{
			if (hashSet2.Add(item8))
			{
				list5.Add(item8);
			}
		}
		return list5;
		int Compare(string a, string b)
		{
			BlockFileInfo value3;
			BlockKind num = (infoByName.TryGetValue(a, out value3) ? value3.Kind : BlockKind.Unknown);
			BlockFileInfo value5;
			BlockKind value4 = (infoByName.TryGetValue(b, out value5) ? value5.Kind : BlockKind.Unknown);
			int num2 = (int)num;
			int num3 = num2.CompareTo((int)value4);
			if (num3 == 0)
			{
				return string.Compare(a, b, StringComparison.OrdinalIgnoreCase);
			}
			return num3;
		}
	}

	private static BlockFileInfo? ParseBlockFile(string filePath)
	{
		try
		{
			switch (Path.GetExtension(filePath).ToLowerInvariant())
			{
			case ".xml":
				return ParseXmlBlock(filePath);
			case ".scl":
			case ".db":
			case ".s7dcl":
				return ParseTextBlock(filePath);
			default:
				return null;
			}
		}
		catch
		{
			return null;
		}
	}

	private static BlockFileInfo? ParseXmlBlock(string filePath)
	{
		XDocument xDocument;
		try
		{
			xDocument = XDocument.Load(filePath);
		}
		catch
		{
			return null;
		}
		XElement root = xDocument.Root;
		if (root == null)
		{
			return null;
		}
		XElement xElement = root.Descendants().FirstOrDefault((XElement e) => e.Name.LocalName == "SW.Blocks.OB" || e.Name.LocalName == "SW.Blocks.FC" || e.Name.LocalName == "SW.Blocks.FB" || e.Name.LocalName == "SW.Blocks.DB" || e.Name.LocalName == "SW.Blocks.GlobalDB" || e.Name.LocalName == "SW.Blocks.InstanceDB");
		if (xElement == null)
		{
			return null;
		}
		BlockFileInfo blockFileInfo = new BlockFileInfo
		{
			FilePath = filePath
		};
		BlockFileInfo blockFileInfo2 = blockFileInfo;
		blockFileInfo2.Kind = xElement.Name.LocalName switch
		{
			"SW.Blocks.OB" => BlockKind.Ob, 
			"SW.Blocks.FC" => BlockKind.Fc, 
			"SW.Blocks.FB" => BlockKind.Fb, 
			"SW.Blocks.DB" => BlockKind.GlobalDb, 
			"SW.Blocks.GlobalDB" => BlockKind.GlobalDb, 
			"SW.Blocks.InstanceDB" => BlockKind.InstanceDb, 
			_ => BlockKind.Unknown, 
		};
		XElement xElement2 = xElement.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "AttributeList");
		blockFileInfo.BlockName = (xElement2?.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "Name"))?.Value?.Trim() ?? Path.GetFileNameWithoutExtension(filePath);
		if (blockFileInfo.Kind == BlockKind.InstanceDb && xElement2 != null)
		{
			string text = xElement2.Elements().FirstOrDefault((XElement e) => e.Name.LocalName == "InstanceOfName")?.Value;
			if (!string.IsNullOrWhiteSpace(text))
			{
				blockFileInfo.Dependencies.Add(text.Trim());
			}
		}
		foreach (XElement item in from e in xElement.Descendants()
			where e.Name.LocalName == "CallInfo"
			select e)
		{
			string text2 = item.Attribute("Name")?.Value?.Trim();
			if (!string.IsNullOrEmpty(text2) && !BuiltInNames.Contains(text2))
			{
				string a = item.Attribute("BlockType")?.Value;
				if (!string.Equals(a, "UDT", StringComparison.OrdinalIgnoreCase) && !string.Equals(a, "FBT", StringComparison.OrdinalIgnoreCase) && !string.Equals(a, "FCT", StringComparison.OrdinalIgnoreCase))
				{
					blockFileInfo.Dependencies.Add(text2);
				}
			}
		}
		string text3 = string.Join("\n", from e in xElement.Descendants()
			where e.Name.LocalName == "StructuredText" || e.Name.LocalName == "Token"
			select e.Value);
		if (!string.IsNullOrWhiteSpace(text3))
		{
			ExtractQuotedIdentifiers(text3, blockFileInfo.Dependencies);
		}
		return blockFileInfo;
	}

	private static BlockFileInfo? ParseTextBlock(string filePath)
	{
		string input;
		try
		{
			input = File.ReadAllText(filePath);
		}
		catch
		{
			return null;
		}
		BlockFileInfo blockFileInfo = new BlockFileInfo
		{
			FilePath = filePath
		};
		blockFileInfo.BlockName = Path.GetFileNameWithoutExtension(filePath);
		string input2 = SclBlockCommentRegex.Replace(input, " ");
		input2 = SclLineCommentRegex.Replace(input2, " ");
		Match match = Regex.Match(input2, "\\b(FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK|DATA_BLOCK|TYPE)\\s+\"([^\"]+)\"", RegexOptions.IgnoreCase);
		if (match.Success)
		{
			blockFileInfo.BlockName = match.Groups[2].Value.Trim();
			BlockFileInfo blockFileInfo2 = blockFileInfo;
			blockFileInfo2.Kind = match.Groups[1].Value.ToUpperInvariant() switch
			{
				"FUNCTION_BLOCK" => BlockKind.Fb, 
				"FUNCTION" => BlockKind.Fc, 
				"ORGANIZATION_BLOCK" => BlockKind.Ob, 
				"DATA_BLOCK" => BlockKind.GlobalDb, 
				_ => BlockKind.Unknown, 
			};
		}
		if (blockFileInfo.Kind == BlockKind.GlobalDb)
		{
			Match match2 = Regex.Match(input2, "DATA_BLOCK\\s+\"[^\"]+\"[^\"]*\"([A-Za-z_][A-Za-z0-9_]*)\"", RegexOptions.IgnoreCase | RegexOptions.Singleline);
			if (match2.Success)
			{
				string text = match2.Groups[1].Value.Trim();
				if (!string.Equals(text, blockFileInfo.BlockName, StringComparison.OrdinalIgnoreCase))
				{
					blockFileInfo.Kind = BlockKind.InstanceDb;
					blockFileInfo.Dependencies.Add(text);
				}
			}
		}
		ExtractQuotedIdentifiers(input2, blockFileInfo.Dependencies);
		blockFileInfo.Dependencies.Remove(blockFileInfo.BlockName);
		return blockFileInfo;
	}

	private static void ExtractQuotedIdentifiers(string text, HashSet<string> target)
	{
		foreach (Match item in QuotedIdentifierRegex.Matches(text))
		{
			string text2 = item.Groups[1].Value.Trim();
			if (!string.IsNullOrEmpty(text2) && !BuiltInNames.Contains(text2))
			{
				target.Add(text2);
			}
		}
	}
}
