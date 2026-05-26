using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Siemens.Engineering;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.ExternalSources;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services.Export;

public class SclExportHandler
{
	public object ExportSclBlock(PlcSoftware plcSoftware, string sclFilePath, ExportToTiaOptions options, List<ExportMessage> messages)
	{
		//IL_0140: Expected O, but got Unknown
		//IL_0290: Expected O, but got Unknown
		//IL_04f7: Expected O, but got Unknown
		//IL_03bd: Unknown result type (might be due to invalid IL or missing references)
		//IL_03d7: Unknown result type (might be due to invalid IL or missing references)
		//IL_03ca: Unknown result type (might be due to invalid IL or missing references)
		string fileName = Path.GetFileName(sclFilePath);
		string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(sclFilePath);
		try
		{
			string text = fileNameWithoutExtension;
			PlcBlockGroup val = (PlcBlockGroup)(object)plcSoftware.BlockGroup;
			PlcBlockUserGroup val2 = null;
			string text2 = "";
			if (options.PreserveFolderStructure && !string.IsNullOrEmpty(options.BasePath))
			{
				string relativeFolderPath = TiaGroupHelper.GetRelativeFolderPath(sclFilePath, options.BasePath);
				if (!string.IsNullOrEmpty(relativeFolderPath))
				{
					val = TiaGroupHelper.GetOrCreateBlockGroup((PlcBlockGroup)(object)plcSoftware.BlockGroup, relativeFolderPath);
					val2 = (PlcBlockUserGroup)(object)((val is PlcBlockUserGroup) ? val : null);
					text2 = " (group: " + relativeFolderPath + ")";
				}
			}
			PlcBlock val3 = TiaGroupHelper.FindBlockByName(val, text);
			if (val3 == null && (object)val != plcSoftware.BlockGroup)
			{
				val3 = TiaGroupHelper.FindBlockByName((PlcBlockGroup)(object)plcSoftware.BlockGroup, text);
			}
			if (val3 == null)
			{
				string text3 = ExtractBlockNameFromSclFile(fileNameWithoutExtension);
				if (!string.IsNullOrEmpty(text3) && text3 != fileNameWithoutExtension)
				{
					val3 = TiaGroupHelper.FindBlockByName(val, text3);
					if (val3 == null && (object)val != plcSoftware.BlockGroup)
					{
						val3 = TiaGroupHelper.FindBlockByName((PlcBlockGroup)(object)plcSoftware.BlockGroup, text3);
					}
					if (val3 != null)
					{
						text = text3;
					}
				}
			}
			if (val3 != null)
			{
				text = val3.Name;
			}
			if (options.OverwriteExisting && !options.CompareBeforeImport && val3 != null)
			{
				try
				{
					val3.Delete();
					messages.Add(ExportMessage.Info(fileName, "SCL Block", "Deleted existing block '" + text + "' before export"));
					val3 = null;
				}
				catch (EngineeringException ex)
				{
					EngineeringException ex2 = ex;
					messages.Add(ExportMessage.Warning(fileName, "SCL Block", "Could not delete existing block '" + text + "': " + ((Exception)(object)ex2).Message + ". Will try to generate anyway..."));
				}
			}
			else if ((options.CompareBeforeImport || !options.OverwriteExisting) && val3 != null)
			{
				string extension = Path.GetExtension(sclFilePath);
				string text4 = Path.Combine(Path.GetTempPath(), $"tia_scl_compare_{Guid.NewGuid()}{extension}");
				try
				{
					if (val3 == null)
					{
						messages.Add(ExportMessage.Warning(fileName, "SCL Block", "Block '" + text + "' exists but doesn't support source comparison - skipping (use 'Nadpisz wszystko' to force update)"));
						return new
						{
							success = true,
							skipped = true,
							filePath = sclFilePath,
							messages = messages
						};
					}
					PlcExternalSourceSystemGroup externalSourceGroup = plcSoftware.ExternalSourceGroup;
					List<IGenerateSource> list = new List<IGenerateSource> { (IGenerateSource)(object)val3 };
					externalSourceGroup.GenerateSource((IEnumerable<IGenerateSource>)list, new FileInfo(text4), (GenerateOptions)0);
					if (!File.Exists(text4))
					{
						messages.Add(ExportMessage.Warning(fileName, "SCL Block", "Block '" + text + "' exists but comparison failed - skipping (use 'Nadpisz wszystko' to force update)"));
						return new
						{
							success = true,
							skipped = true,
							filePath = sclFilePath,
							messages = messages
						};
					}
					string text5 = NormalizeForComparison(File.ReadAllText(text4));
					string text6 = NormalizeForComparison(File.ReadAllText(sclFilePath));
					if (text5 == text6)
					{
						messages.Add(ExportMessage.Info(fileName, "SCL Block", "Block '" + text + "' is identical - skipped"));
						return new
						{
							success = true,
							skipped = true,
							filePath = sclFilePath,
							messages = messages
						};
					}
					try
					{
						val3.Delete();
						messages.Add(ExportMessage.Info(fileName, "SCL Block", "Block '" + text + "' differs - deleted and will be reimported"));
						val3 = null;
					}
					catch (EngineeringException ex3)
					{
						EngineeringException ex4 = ex3;
						messages.Add(ExportMessage.Warning(fileName, "SCL Block", "Could not delete existing block '" + text + "': " + ((Exception)(object)ex4).Message + ". Will try to generate anyway..."));
					}
				}
				finally
				{
					if (File.Exists(text4))
					{
						File.Delete(text4);
					}
				}
			}
			PlcExternalSourceComposition externalSources = ((PlcExternalSourceGroup)plcSoftware.ExternalSourceGroup).ExternalSources;
			PlcExternalSource val4 = externalSources.Find(fileNameWithoutExtension);
			if (val4 != null)
			{
				val4.Delete();
			}
			PlcExternalSource val5 = externalSources.CreateFromFile(fileNameWithoutExtension, sclFilePath);
			if (val5 == null)
			{
				messages.Add(ExportMessage.Error(fileName, "SCL Block", "Failed to create external source", "CreateFromFile returned null"));
				return new
				{
					success = false,
					error = "Failed to create external source",
					messages = messages
				};
			}
			GenerateBlockOption val6 = (GenerateBlockOption)(options.OverwriteExisting ? 1 : 0);
			IList<IEngineeringObject> list2 = null;
			list2 = ((val2 == null) ? val5.GenerateBlocksFromSource(val6) : val5.GenerateBlocksFromSource(val2, val6));
			try
			{
				val5.Delete();
			}
			catch
			{
			}
			if (list2 != null && list2.Count > 0)
			{
				List<string> list3 = new List<string>();
				foreach (IEngineeringObject item in list2)
				{
					PlcBlock val7 = (PlcBlock)(object)((item is PlcBlock) ? item : null);
					if (val7 != null)
					{
						list3.Add(val7.Name);
					}
					else
					{
						list3.Add(((object)item).GetType().Name);
					}
				}
				string text7 = string.Join(", ", list3);
				messages.Add(ExportMessage.Success(fileName, "SCL Block", $"Generated {list2.Count} block(s): {text7} to {plcSoftware.Name}{text2}"));
				return new
				{
					success = true,
					filePath = sclFilePath,
					generatedBlocks = list3,
					messages = messages
				};
			}
			messages.Add(ExportMessage.Warning(fileName, "SCL Block", "External source processed but no blocks were generated"));
			return new
			{
				success = true,
				filePath = sclFilePath,
				warnings = "No blocks generated",
				messages = messages
			};
		}
		catch (EngineeringException ex5)
		{
			string text8 = ErrorHelper.ExtractFullErrorMessage((Exception)ex5);
			messages.Add(ExportMessage.Error(fileName, "SCL Block", "Failed to export SCL block to TIA Portal", text8, sclFilePath));
			return new
			{
				success = false,
				error = text8,
				filePath = sclFilePath,
				messages = messages
			};
		}
		catch (Exception ex6)
		{
			string text9 = ErrorHelper.ExtractFullErrorMessage(ex6);
			messages.Add(ExportMessage.Error(fileName, "SCL Block", "Failed to export SCL block to TIA Portal", text9, sclFilePath));
			return new
			{
				success = false,
				error = text9,
				filePath = sclFilePath,
				messages = messages
			};
		}
	}

	private string ExtractBlockNameFromSclFile(string fileNameWithoutExtension)
	{
		string[] array = new string[6] { "_FB", "_FC", "_OB", "_DB", "_IDB", "_GlobalDB" };
		foreach (string value in array)
		{
			int num = fileNameWithoutExtension.LastIndexOf(value, StringComparison.OrdinalIgnoreCase);
			if (num > 0)
			{
				return fileNameWithoutExtension.Substring(0, num);
			}
		}
		return fileNameWithoutExtension;
	}

	private string NormalizeForComparison(string content)
	{
		if (string.IsNullOrEmpty(content))
		{
			return content;
		}
		IEnumerable<string> values = from l in content.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n')
			select l.TrimEnd();
		return string.Join("\n", values).Trim();
	}
}
