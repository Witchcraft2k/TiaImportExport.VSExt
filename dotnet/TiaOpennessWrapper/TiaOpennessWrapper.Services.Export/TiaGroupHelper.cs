using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.Tags;
using Siemens.Engineering.SW.Types;
using Siemens.Engineering.SW.WatchAndForceTables;

namespace TiaOpennessWrapper.Services.Export;

public static class TiaGroupHelper
{
	private static readonly string[] TiaSystemFolders = new string[15]
	{
		"Program blocks", "Program_blocks", "ProgramBlocks", "PLC tags", "PLC_tags", "PLCTags", "PLC data types", "PLC_data_types", "PLCDataTypes", "Watch and force tables",
		"Watch_and_force_tables", "WatchAndForceTables", "PLC types", "PLC_types", "PLCTypes"
	};

	public static PlcBlockGroup GetOrCreateBlockGroup(PlcBlockGroup rootGroup, string? relativeFolderPath)
	{
		if (string.IsNullOrEmpty(relativeFolderPath))
		{
			return rootGroup;
		}
		string[] array = relativeFolderPath.Split(new char[2]
		{
			Path.DirectorySeparatorChar,
			Path.AltDirectorySeparatorChar
		}, StringSplitOptions.RemoveEmptyEntries);
		PlcBlockGroup val = rootGroup;
		string[] array2 = array;
		foreach (string text in array2)
		{
			PlcBlockUserGroup val2 = null;
			foreach (PlcBlockUserGroup group in val.Groups)
			{
				if (group.Name.Equals(text, StringComparison.OrdinalIgnoreCase))
				{
					val2 = group;
					break;
				}
			}
			val = (PlcBlockGroup)(object)((val2 == null) ? val.Groups.Create(text) : val2);
		}
		return val;
	}

	public static PlcTagTableGroup GetOrCreateTagTableGroup(PlcTagTableGroup rootGroup, string? relativeFolderPath)
	{
		if (string.IsNullOrEmpty(relativeFolderPath))
		{
			return rootGroup;
		}
		string[] array = relativeFolderPath.Split(new char[2]
		{
			Path.DirectorySeparatorChar,
			Path.AltDirectorySeparatorChar
		}, StringSplitOptions.RemoveEmptyEntries);
		PlcTagTableGroup val = rootGroup;
		string[] array2 = array;
		foreach (string text in array2)
		{
			PlcTagTableUserGroup val2 = null;
			foreach (PlcTagTableUserGroup group in val.Groups)
			{
				if (group.Name.Equals(text, StringComparison.OrdinalIgnoreCase))
				{
					val2 = group;
					break;
				}
			}
			val = (PlcTagTableGroup)(object)((val2 == null) ? val.Groups.Create(text) : val2);
		}
		return val;
	}

	public static PlcTypeGroup GetOrCreateTypeGroup(PlcTypeGroup rootGroup, string? relativeFolderPath)
	{
		if (string.IsNullOrEmpty(relativeFolderPath))
		{
			return rootGroup;
		}
		string[] array = relativeFolderPath.Split(new char[2]
		{
			Path.DirectorySeparatorChar,
			Path.AltDirectorySeparatorChar
		}, StringSplitOptions.RemoveEmptyEntries);
		PlcTypeGroup val = rootGroup;
		string[] array2 = array;
		foreach (string text in array2)
		{
			PlcTypeUserGroup val2 = null;
			foreach (PlcTypeUserGroup group in val.Groups)
			{
				if (group.Name.Equals(text, StringComparison.OrdinalIgnoreCase))
				{
					val2 = group;
					break;
				}
			}
			val = (PlcTypeGroup)(object)((val2 == null) ? val.Groups.Create(text) : val2);
		}
		return val;
	}

	public static string? GetRelativeFolderPath(string filePath, string? basePath)
	{
		if (string.IsNullOrEmpty(basePath))
		{
			return null;
		}
		string directoryName = Path.GetDirectoryName(filePath);
		if (string.IsNullOrEmpty(directoryName))
		{
			return null;
		}
		string text = Path.GetFullPath(basePath).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
		string text2 = Path.GetFullPath(directoryName).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
		if (text2.StartsWith(text, StringComparison.OrdinalIgnoreCase))
		{
			string text3 = text2.Substring(text.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
			if (string.IsNullOrEmpty(text3))
			{
				return null;
			}
			List<string> pathParts = text3.Split(new char[2]
			{
				Path.DirectorySeparatorChar,
				Path.AltDirectorySeparatorChar
			}, StringSplitOptions.RemoveEmptyEntries).ToList();
			int num = -1;
			int i;
			for (i = 0; i < pathParts.Count; i++)
			{
				if (TiaSystemFolders.Any((string sf) => sf.Equals(pathParts[i], StringComparison.OrdinalIgnoreCase)))
				{
					num = i;
				}
			}
			if (num >= 0 && num < pathParts.Count - 1)
			{
				List<string> list = pathParts.Skip(num + 1).ToList();
				if (list.Count <= 0)
				{
					return null;
				}
				return string.Join(Path.DirectorySeparatorChar.ToString(), list);
			}
			if (num >= 0)
			{
				return null;
			}
			return text3;
		}
		return null;
	}

	public static PlcBlockGroup? FindBlockGroup(PlcBlockGroup rootGroup, string? relativeFolderPath)
	{
		if (string.IsNullOrEmpty(relativeFolderPath))
		{
			return rootGroup;
		}
		string[] array = relativeFolderPath.Split(new char[2]
		{
			Path.DirectorySeparatorChar,
			Path.AltDirectorySeparatorChar
		}, StringSplitOptions.RemoveEmptyEntries);
		PlcBlockGroup val = rootGroup;
		string[] array2 = array;
		foreach (string value in array2)
		{
			PlcBlockUserGroup val2 = null;
			foreach (PlcBlockUserGroup group in val.Groups)
			{
				if (group.Name.Equals(value, StringComparison.OrdinalIgnoreCase))
				{
					val2 = group;
					break;
				}
			}
			if (val2 != null)
			{
				val = (PlcBlockGroup)(object)val2;
				continue;
			}
			return null;
		}
		return val;
	}

	public static PlcBlock? FindBlockByName(PlcBlockGroup group, string? blockName)
	{
		if (string.IsNullOrEmpty(blockName))
		{
			return null;
		}
		foreach (PlcBlock block in group.Blocks)
		{
			if (block.Name.Equals(blockName, StringComparison.OrdinalIgnoreCase))
			{
				return block;
			}
		}
		foreach (PlcBlockUserGroup group2 in group.Groups)
		{
			PlcBlock val = FindBlockByName((PlcBlockGroup)(object)group2, blockName);
			if (val != null)
			{
				return val;
			}
		}
		return null;
	}

	public static void DeleteOrphanedBlockGroups(PlcBlockGroup tiaGroup, string localFolderPath, List<string> deletedGroups, List<string> errors)
	{
		if (!Directory.Exists(localFolderPath))
		{
			return;
		}
		HashSet<string> hashSet = (from d in Directory.GetDirectories(localFolderPath)
			select Path.GetFileName(d)).ToHashSet(StringComparer.OrdinalIgnoreCase);
		List<(PlcBlockUserGroup, string)> list = new List<(PlcBlockUserGroup, string)>();
		foreach (PlcBlockUserGroup group in tiaGroup.Groups)
		{
			if (!hashSet.Contains(group.Name))
			{
				list.Add((group, group.Name));
			}
		}
		foreach (var (val, text) in list)
		{
			try
			{
				val.Delete();
				deletedGroups.Add(text);
			}
			catch (Exception ex)
			{
				errors.Add(text + ": " + ex.Message);
			}
		}
		foreach (PlcBlockUserGroup item in ((IEnumerable<PlcBlockUserGroup>)tiaGroup.Groups).ToList())
		{
			string text2 = Path.Combine(localFolderPath, item.Name);
			if (Directory.Exists(text2))
			{
				DeleteOrphanedBlockGroups((PlcBlockGroup)(object)item, text2, deletedGroups, errors);
			}
		}
	}

	public static void DeleteOrphanedBlocks(PlcBlockGroup tiaGroup, string localFolderPath, List<string> deletedBlocks, List<string> errors)
	{
		if (!Directory.Exists(localFolderPath))
		{
			return;
		}
		HashSet<string> localBlockNames = GetLocalBlockNames(localFolderPath);
		List<(PlcBlock, string)> list = new List<(PlcBlock, string)>();
		foreach (PlcBlock block in tiaGroup.Blocks)
		{
			if (!localBlockNames.Contains(block.Name))
			{
				string item = $"{block.Name} ({GetBlockType(block)}{block.Number})";
				list.Add((block, item));
			}
		}
		foreach (var (val, text) in list)
		{
			try
			{
				val.Delete();
				deletedBlocks.Add(text);
			}
			catch (Exception ex)
			{
				errors.Add(text + ": " + ex.Message);
			}
		}
		foreach (PlcBlockUserGroup item2 in ((IEnumerable<PlcBlockUserGroup>)tiaGroup.Groups).ToList())
		{
			string text2 = Path.Combine(localFolderPath, item2.Name);
			if (Directory.Exists(text2))
			{
				DeleteOrphanedBlocks((PlcBlockGroup)(object)item2, text2, deletedBlocks, errors);
			}
		}
	}

	private static HashSet<string> GetLocalBlockNames(string folderPath)
	{
		HashSet<string> hashSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
		try
		{
			string[] array = new string[4] { "*.xml", "*.s7dcl", "*.scl", "*.db" };
			foreach (string searchPattern in array)
			{
				string[] files = Directory.GetFiles(folderPath, searchPattern);
				for (int j = 0; j < files.Length; j++)
				{
					string item = ExtractBlockNameFromFileName(Path.GetFileNameWithoutExtension(files[j]));
					hashSet.Add(item);
				}
			}
		}
		catch (Exception)
		{
		}
		return hashSet;
	}

	private static string ExtractBlockNameFromFileName(string fileName)
	{
		Match match = Regex.Match(fileName, "^(.+)_(FB|DB|OB|FC)\\d+$", RegexOptions.IgnoreCase);
		if (match.Success)
		{
			return match.Groups[1].Value;
		}
		return fileName;
	}

	private static string GetBlockType(PlcBlock block)
	{
		if (!(block is FB))
		{
			if (!(block is InstanceDB))
			{
				if (!(block is GlobalDB))
				{
					if (!(block is OB))
					{
						if (block is FC)
						{
							return "FC";
						}
						return "Block";
					}
					return "OB";
				}
				return "DB";
			}
			return "DB";
		}
		return "FB";
	}

	public static void DeleteOrphanedTagTableGroups(PlcTagTableGroup tiaGroup, string localFolderPath, List<string> deletedGroups, List<string> deletedTables, List<string> errors)
	{
		if (!Directory.Exists(localFolderPath))
		{
			return;
		}
		HashSet<string> hashSet = new HashSet<string>(from d in Directory.GetDirectories(localFolderPath)
			select Path.GetFileName(d), StringComparer.OrdinalIgnoreCase);
		List<(PlcTagTableUserGroup, string)> list = new List<(PlcTagTableUserGroup, string)>();
		foreach (PlcTagTableUserGroup group in tiaGroup.Groups)
		{
			if (!hashSet.Contains(group.Name))
			{
				list.Add((group, group.Name));
			}
		}
		foreach (var (val, text) in list)
		{
			try
			{
				val.Delete();
				deletedGroups.Add(text);
			}
			catch (Exception ex)
			{
				errors.Add("Group '" + text + "': " + ex.Message);
			}
		}
		foreach (PlcTagTableUserGroup item in ((IEnumerable<PlcTagTableUserGroup>)tiaGroup.Groups).ToList())
		{
			string text2 = Path.Combine(localFolderPath, item.Name);
			if (Directory.Exists(text2))
			{
				DeleteOrphanedTagTableGroups((PlcTagTableGroup)(object)item, text2, deletedGroups, deletedTables, errors);
			}
		}
		DeleteOrphanedTagTables(tiaGroup, localFolderPath, deletedTables, errors);
	}

	public static void DeleteOrphanedTagTables(PlcTagTableGroup tiaGroup, string localFolderPath, List<string> deletedTables, List<string> errors)
	{
		if (!Directory.Exists(localFolderPath))
		{
			return;
		}
		HashSet<string> localXmlNames = GetLocalXmlNames(localFolderPath);
		List<(PlcTagTable, string)> list = new List<(PlcTagTable, string)>();
		foreach (PlcTagTable tagTable in tiaGroup.TagTables)
		{
			if (!localXmlNames.Contains(tagTable.Name))
			{
				list.Add((tagTable, tagTable.Name));
			}
		}
		foreach (var (val, text) in list)
		{
			try
			{
				val.Delete();
				deletedTables.Add(text);
			}
			catch (Exception ex)
			{
				errors.Add("TagTable '" + text + "': " + ex.Message);
			}
		}
	}

	public static void DeleteOrphanedTypeGroups(PlcTypeGroup tiaGroup, string localFolderPath, List<string> deletedGroups, List<string> deletedTypes, List<string> errors)
	{
		if (!Directory.Exists(localFolderPath))
		{
			return;
		}
		HashSet<string> hashSet = new HashSet<string>(from d in Directory.GetDirectories(localFolderPath)
			select Path.GetFileName(d), StringComparer.OrdinalIgnoreCase);
		List<(PlcTypeUserGroup, string)> list = new List<(PlcTypeUserGroup, string)>();
		foreach (PlcTypeUserGroup group in tiaGroup.Groups)
		{
			if (!hashSet.Contains(group.Name))
			{
				list.Add((group, group.Name));
			}
		}
		foreach (var (val, text) in list)
		{
			try
			{
				val.Delete();
				deletedGroups.Add(text);
			}
			catch (Exception ex)
			{
				errors.Add("Group '" + text + "': " + ex.Message);
			}
		}
		foreach (PlcTypeUserGroup item in ((IEnumerable<PlcTypeUserGroup>)tiaGroup.Groups).ToList())
		{
			string text2 = Path.Combine(localFolderPath, item.Name);
			if (Directory.Exists(text2))
			{
				DeleteOrphanedTypeGroups((PlcTypeGroup)(object)item, text2, deletedGroups, deletedTypes, errors);
			}
		}
		DeleteOrphanedTypes(tiaGroup, localFolderPath, deletedTypes, errors);
	}

	public static void DeleteOrphanedTypes(PlcTypeGroup tiaGroup, string localFolderPath, List<string> deletedTypes, List<string> errors)
	{
		if (!Directory.Exists(localFolderPath))
		{
			return;
		}
		HashSet<string> localXmlNames = GetLocalXmlNames(localFolderPath);
		List<(PlcType, string)> list = new List<(PlcType, string)>();
		foreach (PlcType type in tiaGroup.Types)
		{
			if (!localXmlNames.Contains(type.Name))
			{
				list.Add((type, type.Name));
			}
		}
		foreach (var (val, text) in list)
		{
			try
			{
				val.Delete();
				deletedTypes.Add(text);
			}
			catch (Exception ex)
			{
				errors.Add("UDT '" + text + "': " + ex.Message);
			}
		}
	}

	public static void DeleteOrphanedWatchTables(PlcWatchAndForceTableGroup tiaGroup, string localFolderPath, List<string> deletedTables, List<string> errors)
	{
		if (!Directory.Exists(localFolderPath))
		{
			return;
		}
		HashSet<string> localXmlNames = GetLocalXmlNames(localFolderPath);
		List<(PlcWatchTable, string)> list = new List<(PlcWatchTable, string)>();
		foreach (PlcWatchTable watchTable in tiaGroup.WatchTables)
		{
			if (!localXmlNames.Contains(watchTable.Name))
			{
				list.Add((watchTable, watchTable.Name));
			}
		}
		foreach (var (val, text) in list)
		{
			try
			{
				val.Delete();
				deletedTables.Add(text);
			}
			catch (Exception ex)
			{
				errors.Add("WatchTable '" + text + "': " + ex.Message);
			}
		}
	}

	private static HashSet<string> GetLocalXmlNames(string folderPath)
	{
		HashSet<string> hashSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
		try
		{
			string[] files = Directory.GetFiles(folderPath, "*.xml");
			for (int i = 0; i < files.Length; i++)
			{
				string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(files[i]);
				hashSet.Add(fileNameWithoutExtension);
			}
		}
		catch (Exception)
		{
		}
		return hashSet;
	}
}
