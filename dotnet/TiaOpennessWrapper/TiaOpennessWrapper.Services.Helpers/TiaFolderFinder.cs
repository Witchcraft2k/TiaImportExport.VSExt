using System;
using System.IO;
using System.Linq;

namespace TiaOpennessWrapper.Services.Helpers;

internal static class TiaFolderFinder
{
	public static readonly string[] ProgramBlocksVariants = new string[4] { "Program blocks", "Program_blocks", "ProgramBlocks", "Programblocks" };

	public static readonly string[] PlcTagsVariants = new string[4] { "PLC tags", "PLC_tags", "PLCTags", "Plctags" };

	public static readonly string[] PlcDataTypesVariants = new string[7] { "PLC data types", "PLC_data_types", "PLCDataTypes", "Plcdatatypes", "PLC types", "PLC_types", "PLCTypes" };

	public static readonly string[] WatchTablesVariants = new string[4] { "Watch and force tables", "Watch_and_force_tables", "WatchAndForceTables", "Watchandforcetables" };

	public static string? FindFolder(string folderPath, string[] nameVariants)
	{
		string text = folderPath.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
		string[] array = text.Split(Path.DirectorySeparatorChar);
		if (IsMatch(Path.GetFileName(text.TrimEnd(Path.DirectorySeparatorChar)), nameVariants))
		{
			return folderPath;
		}
		for (int i = 0; i < array.Length; i++)
		{
			if (IsMatch(array[i], nameVariants))
			{
				return string.Join(Path.DirectorySeparatorChar.ToString(), array.Take(i + 1));
			}
		}
		if (Directory.Exists(folderPath))
		{
			string text2 = Directory.GetDirectories(folderPath).FirstOrDefault((string d) => IsMatch(Path.GetFileName(d), nameVariants));
			if (text2 != null)
			{
				return text2;
			}
		}
		return null;
	}

	public static bool IsMatch(string folderName, string[] nameVariants)
	{
		return nameVariants.Any((string v) => v.Equals(folderName, StringComparison.OrdinalIgnoreCase));
	}
}
