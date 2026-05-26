using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.Export;

namespace TiaOpennessWrapper.Services;

public class XmlExportToTiaService
{
	private readonly IDeviceLocator _devices;

	private readonly BlockExportHandler _blockHandler;

	private readonly TagTableExportHandler _tagTableHandler;

	private readonly UdtExportHandler _udtHandler;

	private readonly WatchTableExportHandler _watchTableHandler;

	private readonly SclExportHandler _sclHandler;

	public XmlExportToTiaService(IDeviceLocator devices)
	{
		_devices = devices ?? throw new ArgumentNullException("devices");
		_blockHandler = new BlockExportHandler();
		_tagTableHandler = new TagTableExportHandler();
		_udtHandler = new UdtExportHandler();
		_watchTableHandler = new WatchTableExportHandler();
		_sclHandler = new SclExportHandler();
	}

	public async Task<object> ExportXmlFileAsync(ProjectBase? currentProject, string deviceId, string xmlFilePath, ExportToTiaOptions options)
	{
		return await Task.Run(delegate
		{
			//IL_0095: Expected O, but got Unknown
			List<ExportMessage> messages = new List<ExportMessage>();
			try
			{
				object obj = ValidateInputs(currentProject, deviceId, xmlFilePath);
				if (obj != null)
				{
					return obj;
				}
				Device device = _devices.FindDevice(deviceId);
				PlcSoftware plcSoftware = _devices.GetPlcSoftware(device);
				string fileName = Path.GetFileName(xmlFilePath);
				XmlExportType fileType = XmlTypeDetector.DetectXmlType(xmlFilePath);
				return ExportByType(plcSoftware, xmlFilePath, fileType, options, messages, fileName);
			}
			catch (EngineeringException ex)
			{
				EngineeringException ex2 = ex;
				return HandleException((Exception)(object)ex2, Path.GetFileName(xmlFilePath), messages);
			}
			catch (Exception ex3)
			{
				return HandleException(ex3, Path.GetFileName(xmlFilePath), messages);
			}
		});
	}

	public async Task<object> ExportXmlFolderAsync(ProjectBase? currentProject, string deviceId, string folderPath, ExportToTiaOptions options)
	{
		return await Task.Run((Func<object>)delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			int num = 0;
			int num2 = 0;
			int num3 = 0;
			try
			{
				InstanceDbSourceGenerator.CleanIdbSourceCache(options.BasePath);
				XmlComparisonService.CleanComparisonDebugCache(options.BasePath);
				if (currentProject == null)
				{
					return new
					{
						success = false,
						error = "No project selected",
						messages = new List<ExportMessage>()
					};
				}
				if (!Directory.Exists(folderPath))
				{
					return new
					{
						success = false,
						error = "Folder not found: " + folderPath,
						messages = new List<ExportMessage>()
					};
				}
				Device val = _devices.FindDevice(deviceId);
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device '" + deviceId + "' not found",
						messages = new List<ExportMessage>()
					};
				}
				PlcSoftware plcSoftware = _devices.GetPlcSoftware(val);
				if (plcSoftware == null)
				{
					return new
					{
						success = false,
						error = "PLC software not found",
						messages = new List<ExportMessage>()
					};
				}
				SearchOption searchOption = (options.Recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly);
				List<string> list2 = new List<string>();
				list2.AddRange(Directory.GetFiles(folderPath, "*.xml", searchOption));
				list2.AddRange(Directory.GetFiles(folderPath, "*.s7dcl", searchOption));
				list2.AddRange(Directory.GetFiles(folderPath, "*.scl", searchOption));
				list2.AddRange(Directory.GetFiles(folderPath, "*.db", searchOption));
				if (list2.Count == 0)
				{
					return new
					{
						success = true,
						itemCount = 0,
						message = "No supported files (XML, .s7dcl, .scl, .db) found in the folder",
						messages = list
					};
				}
				string[] array = XmlTypeDetector.SortFilesForExport(list2.ToArray());
				foreach (string text in array)
				{
					string fileName = Path.GetFileName(text);
					try
					{
						XmlExportType xmlExportType = XmlTypeDetector.DetectXmlType(text);
						switch (xmlExportType)
						{
						case XmlExportType.Unknown:
							list.Add(ExportMessage.Warning(fileName, "Unknown", "Skipped - could not determine file type"));
							num3++;
							break;
						case XmlExportType.SdResource:
							break;
						default:
						{
							dynamic val2 = ExportByType(plcSoftware, text, xmlExportType, options, list, fileName);
							if (val2.success == true)
							{
								bool flag = false;
								try
								{
									flag = val2.skipped == true;
								}
								catch
								{
								}
								if (flag)
								{
									num3++;
								}
								else
								{
									num++;
								}
							}
							else
							{
								num2++;
							}
							break;
						}
						}
					}
					catch (Exception ex)
					{
						list.Add(ExportMessage.Error(fileName, "Export", "Error exporting file", ex.Message));
						num2++;
					}
				}
				if (options.DeleteOrphanedGroups && options.PreserveFolderStructure)
				{
					try
					{
						List<string> list3 = new List<string>();
						List<string> list4 = new List<string>();
						List<string> list5 = new List<string>();
						string text2 = FindProgramBlocksFolder(folderPath);
						if (text2 != null)
						{
							PlcBlockGroup val3 = (PlcBlockGroup)(object)plcSoftware.BlockGroup;
							string localFolderPath = text2;
							string text3 = folderPath.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).TrimEnd(Path.DirectorySeparatorChar);
							string text4 = text2.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).TrimEnd(Path.DirectorySeparatorChar);
							if (text3.Length > text4.Length && text3.StartsWith(text4, StringComparison.OrdinalIgnoreCase))
							{
								string relativeFolderPath = text3.Substring(text4.Length + 1);
								PlcBlockGroup val4 = TiaGroupHelper.FindBlockGroup(val3, relativeFolderPath);
								if (val4 != null)
								{
									val3 = val4;
									localFolderPath = folderPath;
								}
							}
							TiaGroupHelper.DeleteOrphanedBlocks(val3, localFolderPath, list4, list5);
							foreach (string item in list4)
							{
								list.Add(ExportMessage.Deleted(item, "Block", "Deleted orphaned block: " + item));
							}
							TiaGroupHelper.DeleteOrphanedBlockGroups(val3, localFolderPath, list3, list5);
							foreach (string item2 in list3)
							{
								list.Add(ExportMessage.Deleted(item2, "Folder", "Deleted orphaned group: " + item2));
							}
							foreach (string item3 in list5)
							{
								list.Add(ExportMessage.Warning("DeleteOrphan", "Item", "Failed to delete: " + item3));
							}
						}
					}
					catch (Exception ex2)
					{
						list.Add(ExportMessage.Warning("DeleteOrphans", "Cleanup", "Failed to clean up orphaned items: " + ex2.Message));
					}
				}
				return new
				{
					success = (num2 == 0),
					itemCount = num + num2 + num3,
					successCount = num,
					errorCount = num2,
					skippedCount = num3,
					messages = list
				};
			}
			catch (Exception ex3)
			{
				string text5 = ErrorHelper.ExtractFullErrorMessage(ex3);
				list.Add(ExportMessage.Error("ExportXmlFolder", "Operation", "Failed to export folder to TIA Portal", text5));
				return new
				{
					success = false,
					error = text5,
					messages = list
				};
			}
		});
	}

	private object? ValidateInputs(ProjectBase? currentProject, string deviceId, string xmlFilePath)
	{
		if (currentProject == null)
		{
			return new
			{
				success = false,
				error = "No project selected",
				messages = new List<ExportMessage>()
			};
		}
		if (!File.Exists(xmlFilePath))
		{
			return new
			{
				success = false,
				error = "File not found: " + xmlFilePath,
				messages = new List<ExportMessage>()
			};
		}
		Device val = _devices.FindDevice(deviceId);
		if (val == null)
		{
			return new
			{
				success = false,
				error = "Device '" + deviceId + "' not found",
				messages = new List<ExportMessage>()
			};
		}
		if (_devices.GetPlcSoftware(val) == null)
		{
			return new
			{
				success = false,
				error = "PLC software not found",
				messages = new List<ExportMessage>()
			};
		}
		return null;
	}

	private object ExportByType(PlcSoftware plcSoftware, string filePath, XmlExportType fileType, ExportToTiaOptions options, List<ExportMessage> messages, string fileName)
	{
		switch (fileType)
		{
		case XmlExportType.Block:
			return _blockHandler.ExportBlock(plcSoftware, filePath, options, messages);
		case XmlExportType.InstanceDB:
			return _blockHandler.ExportInstanceDB(plcSoftware, filePath, options, messages);
		case XmlExportType.TagTable:
			return _tagTableHandler.ExportTagTable(plcSoftware, filePath, options, messages);
		case XmlExportType.UserDataType:
			return _udtHandler.ExportUserDataType(plcSoftware, filePath, options, messages);
		case XmlExportType.WatchTable:
			return _watchTableHandler.ExportWatchTable(plcSoftware, filePath, options, messages);
		case XmlExportType.SdBlock:
			messages.Add(ExportMessage.Error(fileName, "SD Block", "SD format (.s7dcl/.s7res) requires TIA Portal V20 or newer. This wrapper was built for V19 only. Use XML format instead.", null, filePath));
			return new
			{
				success = false,
				error = "SD format not supported on V19",
				filePath = filePath,
				messages = messages
			};
		case XmlExportType.SclBlock:
			return _sclHandler.ExportSclBlock(plcSoftware, filePath, options, messages);
		case XmlExportType.SdResource:
			messages.Add(ExportMessage.Info(fileName, "SD Resource", "Resource file - handled with .s7dcl"));
			return new
			{
				success = true,
				skipped = true,
				filePath = filePath,
				messages = messages
			};
		case XmlExportType.KnowHowProtectedBlock:
			messages.Add(ExportMessage.Info(fileName, "Block", "Know-how protected block - skipped (cannot be imported to TIA Portal)"));
			return new
			{
				success = true,
				skipped = true,
				filePath = filePath,
				messages = messages
			};
		default:
			messages.Add(ExportMessage.Warning(fileName, "Unknown", "Could not determine file type. Trying as XML block..."));
			return _blockHandler.ExportBlock(plcSoftware, filePath, options, messages);
		}
	}

	private object HandleException(Exception ex, string fileName, List<ExportMessage> messages)
	{
		string text = ErrorHelper.ExtractFullErrorMessage(ex);
		messages.Add(ExportMessage.Error(fileName, "Export", "Failed to export to TIA Portal", text));
		return new
		{
			success = false,
			error = text,
			messages = messages
		};
	}

	private string? FindProgramBlocksFolder(string folderPath)
	{
		string text = folderPath.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
		string[] array = text.Split(Path.DirectorySeparatorChar);
		string fileName = Path.GetFileName(text.TrimEnd(Path.DirectorySeparatorChar));
		if (IsProgramBlocksFolder(fileName))
		{
			return folderPath;
		}
		for (int i = 0; i < array.Length; i++)
		{
			if (IsProgramBlocksFolder(array[i]))
			{
				return string.Join(Path.DirectorySeparatorChar.ToString(), array.Take(i + 1));
			}
		}
		string text2 = Directory.GetDirectories(folderPath).FirstOrDefault((string d) => IsProgramBlocksFolder(Path.GetFileName(d)));
		if (text2 != null)
		{
			return text2;
		}
		return null;
	}

	private bool IsProgramBlocksFolder(string folderName)
	{
		return new string[4] { "Program blocks", "Program_blocks", "ProgramBlocks", "Programblocks" }.Any((string v) => v.Equals(folderName, StringComparison.OrdinalIgnoreCase));
	}
}

