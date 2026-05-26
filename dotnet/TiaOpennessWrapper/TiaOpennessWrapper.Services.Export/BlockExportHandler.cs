using System;
using System.Collections.Generic;
using System.IO;
using Siemens.Engineering;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services.Export;

public class BlockExportHandler
{
	public object ExportBlock(PlcSoftware plcSoftware, string xmlFilePath, ExportToTiaOptions options, List<ExportMessage> messages)
	{
		//IL_01c6: Expected O, but got Unknown
		//IL_02ac: Expected O, but got Unknown
		//IL_037c: Expected O, but got Unknown
		//IL_0336: Unknown result type (might be due to invalid IL or missing references)
		//IL_033f: Unknown result type (might be due to invalid IL or missing references)
		string fileName = Path.GetFileName(xmlFilePath);
		try
		{
			if (XmlTypeDetector.DetectXmlType(xmlFilePath) == XmlExportType.KnowHowProtectedBlock)
			{
				messages.Add(ExportMessage.Info(fileName, "Block", "Know-how protected block - skipped (cannot be imported to TIA Portal)"));
				return new
				{
					success = true,
					skipped = true,
					filePath = xmlFilePath,
					messages = messages
				};
			}
			FileInfo fileInfo = new FileInfo(xmlFilePath);
			PlcBlockGroup val = (PlcBlockGroup)(object)plcSoftware.BlockGroup;
			string text = "";
			if (options.PreserveFolderStructure && !string.IsNullOrEmpty(options.BasePath))
			{
				string relativeFolderPath = TiaGroupHelper.GetRelativeFolderPath(xmlFilePath, options.BasePath);
				if (!string.IsNullOrEmpty(relativeFolderPath))
				{
					val = TiaGroupHelper.GetOrCreateBlockGroup((PlcBlockGroup)(object)plcSoftware.BlockGroup, relativeFolderPath);
					text = " (group: " + relativeFolderPath + ")";
				}
			}
			string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(xmlFilePath);
			string text2 = fileNameWithoutExtension;
			PlcBlock val2 = null;
			val2 = TiaGroupHelper.FindBlockByName(val, text2);
			if (val2 == null && (object)val != plcSoftware.BlockGroup)
			{
				val2 = TiaGroupHelper.FindBlockByName((PlcBlockGroup)(object)plcSoftware.BlockGroup, text2);
			}
			if (val2 == null)
			{
				string text3 = XmlComparisonService.ExtractBlockNameFromXml(xmlFilePath);
				if (!string.IsNullOrEmpty(text3) && text3 != fileNameWithoutExtension)
				{
					val2 = TiaGroupHelper.FindBlockByName(val, text3);
					if (val2 == null && (object)val != plcSoftware.BlockGroup)
					{
						val2 = TiaGroupHelper.FindBlockByName((PlcBlockGroup)(object)plcSoftware.BlockGroup, text3);
					}
					if (val2 != null)
					{
						text2 = text3;
					}
				}
			}
			if (val2 == null)
			{
				string text4 = ExtractBlockNameFromFileName(fileNameWithoutExtension);
				if (!string.IsNullOrEmpty(text4) && text4 != fileNameWithoutExtension)
				{
					val2 = TiaGroupHelper.FindBlockByName(val, text4);
					if (val2 == null && (object)val != plcSoftware.BlockGroup)
					{
						val2 = TiaGroupHelper.FindBlockByName((PlcBlockGroup)(object)plcSoftware.BlockGroup, text4);
					}
					if (val2 != null)
					{
						text2 = text4;
					}
				}
			}
			if (val2 != null)
			{
				text2 = val2.Name;
			}
			if (options.OverwriteExisting && !options.CompareBeforeImport && val2 != null)
			{
				try
				{
					val2.Delete();
					messages.Add(ExportMessage.Info(fileName, "Block", "Deleted existing block '" + text2 + "' before export"));
					val2 = null;
				}
				catch (EngineeringException ex)
				{
					EngineeringException ex2 = ex;
					messages.Add(ExportMessage.Warning(fileName, "Block", "Could not delete existing block '" + text2 + "': " + ((Exception)(object)ex2).Message + ". Trying import with Override..."));
				}
			}
			else if ((options.CompareBeforeImport || !options.OverwriteExisting) && val2 != null)
			{
				switch (XmlComparisonService.CompareBlockWithXml(val2, xmlFilePath, options.BasePath))
				{
				case BlockComparisonResult.Same:
					messages.Add(ExportMessage.Info(fileName, "Block", "Block '" + text2 + "' is identical - skipped"));
					return new
					{
						success = true,
						skipped = true,
						filePath = xmlFilePath,
						messages = messages
					};
				case BlockComparisonResult.Different:
					break;
				default:
					messages.Add(ExportMessage.Warning(fileName, "Block", "Block '" + text2 + "' exists but comparison failed - skipping (use Overwrite to force update)"));
					return new
					{
						success = true,
						skipped = true,
						filePath = xmlFilePath,
						messages = messages
					};
				}
				try
				{
					val2.Delete();
					messages.Add(ExportMessage.Info(fileName, "Block", "Block '" + text2 + "' differs - deleted and will be reimported"));
					val2 = null;
				}
				catch (EngineeringException ex3)
				{
					EngineeringException ex4 = ex3;
					messages.Add(ExportMessage.Warning(fileName, "Block", "Could not delete existing block '" + text2 + "': " + ((Exception)(object)ex4).Message + ". Trying import with Override..."));
				}
			}
			ImportOptions val3 = (ImportOptions)(options.OverwriteExisting ? 1 : 0);
			val.Blocks.Import(fileInfo, val3);
			messages.Add(ExportMessage.Success(fileName, "Block", "Exported successfully to " + plcSoftware.Name + text));
			return new
			{
				success = true,
				filePath = xmlFilePath,
				messages = messages
			};
		}
		catch (EngineeringException ex5)
		{
			string text5 = ErrorHelper.ExtractFullErrorMessage((Exception)ex5);
			messages.Add(ExportMessage.Error(fileName, "Block", "Failed to export block to TIA Portal", text5, xmlFilePath));
			return new
			{
				success = false,
				error = text5,
				filePath = xmlFilePath,
				messages = messages
			};
		}
		catch (Exception ex6)
		{
			string text6 = ErrorHelper.ExtractFullErrorMessage(ex6);
			messages.Add(ExportMessage.Error(fileName, "Block", "Failed to export block to TIA Portal", text6, xmlFilePath));
			return new
			{
				success = false,
				error = text6,
				filePath = xmlFilePath,
				messages = messages
			};
		}
	}

	private string? ExtractBlockNameFromFileName(string fileNameWithoutExtension)
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
		return null;
	}

	public object ExportInstanceDB(PlcSoftware plcSoftware, string xmlFilePath, ExportToTiaOptions options, List<ExportMessage> messages)
	{
		//IL_022b: Expected O, but got Unknown
		//IL_0464: Expected O, but got Unknown
		string fileName = Path.GetFileName(xmlFilePath);
		try
		{
			var (flag, text, text2, num) = XmlComparisonService.ExtractInstanceDBInfo(xmlFilePath);
			if (!flag || string.IsNullOrEmpty(text))
			{
				messages.Add(ExportMessage.Warning(fileName, "InstanceDB", "Could not determine parent FB name - falling back to XML import"));
				return ExportBlock(plcSoftware, xmlFilePath, options, messages);
			}
			if (string.IsNullOrEmpty(text2))
			{
				text2 = Path.GetFileNameWithoutExtension(xmlFilePath);
			}
			PlcBlockGroup val = (PlcBlockGroup)(object)plcSoftware.BlockGroup;
			string text3 = "";
			if (options.PreserveFolderStructure && !string.IsNullOrEmpty(options.BasePath))
			{
				string relativeFolderPath = TiaGroupHelper.GetRelativeFolderPath(xmlFilePath, options.BasePath);
				if (!string.IsNullOrEmpty(relativeFolderPath))
				{
					val = TiaGroupHelper.GetOrCreateBlockGroup((PlcBlockGroup)(object)plcSoftware.BlockGroup, relativeFolderPath);
					text3 = " (group: " + relativeFolderPath + ")";
				}
			}
			PlcBlock val2 = TiaGroupHelper.FindBlockByName(val, text2);
			if (val2 == null && (object)val != plcSoftware.BlockGroup)
			{
				val2 = TiaGroupHelper.FindBlockByName((PlcBlockGroup)(object)plcSoftware.BlockGroup, text2);
			}
			if (val2 != null)
			{
				InstanceDB val3 = (InstanceDB)(object)((val2 is InstanceDB) ? val2 : null);
				if (val3 != null)
				{
					try
					{
						string instanceOfName = val3.InstanceOfName;
						if (string.Equals(instanceOfName, text, StringComparison.OrdinalIgnoreCase))
						{
							if (XmlComparisonService.CompareInstanceDbStartValues(val2, xmlFilePath, options.BasePath) == BlockComparisonResult.Same)
							{
								messages.Add(ExportMessage.Info(fileName, "InstanceDB", "Instance DB '" + text2 + "' (instance of '" + text + "') is identical - skipped"));
								return new
								{
									success = true,
									skipped = true,
									filePath = xmlFilePath,
									messages = messages
								};
							}
							messages.Add(ExportMessage.Info(fileName, "InstanceDB", "Instance DB '" + text2 + "' content differs - will be recreated"));
						}
						else
						{
							messages.Add(ExportMessage.Info(fileName, "InstanceDB", "Instance DB '" + text2 + "' references different FB ('" + instanceOfName + "' -> '" + text + "') - will be recreated"));
						}
					}
					catch
					{
					}
				}
				if (!options.OverwriteExisting)
				{
					messages.Add(ExportMessage.Info(fileName, "InstanceDB", "Instance DB '" + text2 + "' already exists - skipped"));
					return new
					{
						success = true,
						skipped = true,
						filePath = xmlFilePath,
						messages = messages
					};
				}
				try
				{
					val2.Delete();
					messages.Add(ExportMessage.Info(fileName, "InstanceDB", "Deleted existing Instance DB '" + text2 + "' before recreation"));
				}
				catch (EngineeringException ex)
				{
					EngineeringException ex2 = ex;
					messages.Add(ExportMessage.Warning(fileName, "InstanceDB", "Could not delete existing Instance DB '" + text2 + "': " + ((Exception)(object)ex2).Message + ". Falling back to XML import..."));
					return ExportBlock(plcSoftware, xmlFilePath, options, messages);
				}
			}
			bool flag2 = num == 0;
			try
			{
				val.Blocks.CreateInstanceDB(text2, flag2, num, text);
				List<(string, string)> list = InstanceDbSourceGenerator.ExtractStartValuesFromXml(xmlFilePath);
				messages.Add(ExportMessage.Info(fileName, "InstanceDB", $"Extracted {list.Count} StartValue(s) from XML"));
				if (list.Count > 0 && !string.IsNullOrEmpty(text2) && !string.IsNullOrEmpty(text))
				{
					try
					{
						InstanceDbSourceGenerator.ApplyStartValues(plcSoftware, text2, text, list, options.BasePath);
						messages.Add(ExportMessage.Success(fileName, "InstanceDB", "Created Instance DB '" + text2 + "' (instance of '" + text + "') with StartValues in " + plcSoftware.Name + text3));
					}
					catch (Exception ex3)
					{
						string text4 = ErrorHelper.ExtractFullErrorMessage(ex3);
						messages.Add(ExportMessage.Warning(fileName, "InstanceDB", "Instance DB '" + text2 + "' created but StartValues could not be applied: " + text4));
						messages.Add(ExportMessage.Success(fileName, "InstanceDB", "Created Instance DB '" + text2 + "' (instance of '" + text + "') in " + plcSoftware.Name + text3 + " (without StartValues)"));
					}
				}
				else
				{
					messages.Add(ExportMessage.Success(fileName, "InstanceDB", "Created Instance DB '" + text2 + "' (instance of '" + text + "') in " + plcSoftware.Name + text3));
				}
				return new
				{
					success = true,
					filePath = xmlFilePath,
					messages = messages
				};
			}
			catch (EngineeringException ex4)
			{
				string text5 = ErrorHelper.ExtractFullErrorMessage((Exception)ex4);
				messages.Add(ExportMessage.Warning(fileName, "InstanceDB", "CreateInstanceDB failed for '" + text2 + "' (instance of '" + text + "'): " + text5 + ". Falling back to XML import..."));
				return ExportBlock(plcSoftware, xmlFilePath, options, messages);
			}
		}
		catch (Exception ex5)
		{
			string text6 = ErrorHelper.ExtractFullErrorMessage(ex5);
			messages.Add(ExportMessage.Error(fileName, "InstanceDB", "Failed to create Instance DB in TIA Portal", text6, xmlFilePath));
			return new
			{
				success = false,
				error = text6,
				filePath = xmlFilePath,
				messages = messages
			};
		}
	}
}
