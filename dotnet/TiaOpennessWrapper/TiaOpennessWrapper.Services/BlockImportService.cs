using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security;
using System.Text;
using System.Threading.Tasks;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.ExternalSources;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.Export;

namespace TiaOpennessWrapper.Services;

public class BlockImportService
{
	private struct ExportFormatInfo(string effectiveFormat, string filePath, string displayName)
	{
		public string EffectiveFormat = effectiveFormat;

		public string FilePath = filePath;

		public string DisplayName = displayName;
	}

	private enum BlockExportStatus
	{
		Exported,
		Updated,
		Skipped,
		Error
	}

	private readonly IDeviceLocator _devices;

	public BlockImportService(IDeviceLocator devices)
	{
		_devices = devices ?? throw new ArgumentNullException("devices");
	}

	private static ExportFormatInfo ResolveBlockFormat(PlcBlock block, string requestedFormat, string dbExportFormat, string exportPath)
	{
		//IL_0063: Unknown result type (might be due to invalid IL or missing references)
		//IL_0069: Invalid comparison between Unknown and I4
		//IL_0090: Unknown result type (might be due to invalid IL or missing references)
		//IL_0096: Invalid comparison between Unknown and I4
		if (block is InstanceDB)
		{
			return MakeFormatInfo("xml", ".xml", block.Name, exportPath);
		}
		if (block is DataBlock)
		{
			if (dbExportFormat == "db")
			{
				return MakeFormatInfo("scl", ".db", block.Name, exportPath);
			}
			return MakeFormatInfo("xml", ".xml", block.Name, exportPath);
		}
		if ((int)block.ProgrammingLanguage == 6)
		{
			return MakeFormatInfo("xml", ".xml", block.Name, exportPath);
		}
		if (requestedFormat == "sd")
		{
			if ((int)block.ProgrammingLanguage == 4)
			{
				return MakeFormatInfo("scl", ".scl", block.Name, exportPath);
			}
			if (!TiaCapabilities.SupportsSdFormat)
			{
				return MakeFormatInfo("xml", ".xml", block.Name, exportPath);
			}
			return new ExportFormatInfo("sd", Path.Combine(exportPath, block.Name + ".s7dcl"), block.Name);
		}
		if (requestedFormat == "scl")
		{
			return MakeFormatInfo("scl", ".scl", block.Name, exportPath);
		}
		return MakeFormatInfo("xml", ".xml", block.Name, exportPath);
	}

	private static ExportFormatInfo MakeFormatInfo(string format, string ext, string blockName, string exportPath)
	{
		string text = blockName + ext;
		return new ExportFormatInfo(format, Path.Combine(exportPath, text), text);
	}

	private (PlcSoftware? plcSoftware, object? errorResult) ResolveDevicePlcSoftware(ProjectBase? currentProject, string deviceId)
	{
		if (currentProject == null)
		{
			return (plcSoftware: null, errorResult: MakeError("No project selected"));
		}
		Device val = _devices.FindDevice(deviceId);
		if (val == null)
		{
			return (plcSoftware: null, errorResult: MakeError("Device not found"));
		}
		PlcSoftware plcSoftware = _devices.GetPlcSoftware(val);
		if (plcSoftware == null)
		{
			return (plcSoftware: null, errorResult: MakeError("PLC software not found"));
		}
		return (plcSoftware: plcSoftware, errorResult: null);
	}

	private static object MakeError(string error)
	{
		return new
		{
			success = false,
			error = error,
			messages = new List<ExportMessage>()
		};
	}

	private static string ResolveExportPath(string basePath, string? groupPath)
	{
		if (!string.IsNullOrEmpty(groupPath))
		{
			return Path.Combine(basePath, groupPath.Replace("/", Path.DirectorySeparatorChar.ToString()));
		}
		return basePath;
	}

	private (BlockExportStatus status, string? filePath) ExportSingleBlockToFile(PlcBlock block, string exportPath, TiaExportOptions options, List<ExportMessage> messages, PlcSoftware? plcSoftware)
	{
		//IL_0191: Expected O, but got Unknown
		string blockType = GetBlockType(block);
		string text = $"{block.Name} ({blockType}{block.Number})";
		if (options.ExcludeSystemBlocks && IsSystemBlock(block))
		{
			messages.Add(ExportMessage.Info(text, blockType, "Skipped system block: " + block.Name));
			return (status: BlockExportStatus.Skipped, filePath: null);
		}
		if (IsKnowHowProtected(block))
		{
			Directory.CreateDirectory(exportPath);
			var (item, flag) = GenerateProtectedBlockXml(block, exportPath);
			messages.Add(flag ? ExportMessage.Info(text, blockType, "Know-how protected, placeholder unchanged: " + block.Name + ".xml") : ExportMessage.Warning(text, blockType, "Know-how protected, saved placeholder: " + block.Name + ".xml", "Block source code cannot be exported. Placeholder XML created with block metadata."));
			return (status: BlockExportStatus.Exported, filePath: item);
		}
		Directory.CreateDirectory(exportPath);
		string requestedFormat = options.Format?.ToLower() ?? "xml";
		string dbExportFormat = options.DbExportFormat?.ToLower() ?? "xml";
		ExportFormatInfo format = ResolveBlockFormat(block, requestedFormat, dbExportFormat, exportPath);
		bool flag2 = File.Exists(format.FilePath);
		if (flag2 && !options.OverwriteExisting)
		{
			messages.Add(ExportMessage.Info(text, blockType, "Skipped existing file: " + format.DisplayName));
			return (status: BlockExportStatus.Skipped, filePath: format.FilePath);
		}
		try
		{
			return flag2 ? CompareAndUpdateBlock(block, format, text, blockType, exportPath, plcSoftware, messages) : ExportNewBlock(block, format, text, blockType, exportPath, plcSoftware, messages);
		}
		catch (EngineeringException ex)
		{
			EngineeringException ex2 = ex;
			messages.Add(ExportMessage.Error(text, blockType, "TIA Portal error exporting block: " + block.Name, ExtractTiaErrorDetails(ex2)));
			return (status: BlockExportStatus.Error, filePath: null);
		}
		catch (Exception ex3)
		{
			messages.Add(ExportMessage.Error(text, blockType, "Error exporting block: " + block.Name, ex3.Message));
			return (status: BlockExportStatus.Error, filePath: null);
		}
	}

	private (BlockExportStatus status, string? filePath) CompareAndUpdateBlock(PlcBlock block, ExportFormatInfo format, string blockDisplayName, string blockType, string exportPath, PlcSoftware? plcSoftware, List<ExportMessage> messages)
	{
		return CompareAndUpdateSclOrXml(block, format, blockDisplayName, blockType, exportPath, plcSoftware, messages);
	}

	private (BlockExportStatus status, string? filePath) CompareAndUpdateSclOrXml(PlcBlock block, ExportFormatInfo format, string blockDisplayName, string blockType, string exportPath, PlcSoftware? plcSoftware, List<ExportMessage> messages)
	{
		string text = Path.Combine(Path.GetTempPath(), $"tia_compare_{Guid.NewGuid()}_{format.DisplayName}");
		try
		{
			ExportBlockByFormat(block, format.EffectiveFormat, text, plcSoftware);
			bool num;
			if (!(format.EffectiveFormat == "scl"))
			{
				num = XmlComparisonService.CompareXmlContent(format.FilePath, text);
			}
			else
			{
				if (!File.Exists(format.FilePath))
				{
					goto IL_00ac;
				}
				num = File.ReadAllText(format.FilePath) == File.ReadAllText(text);
			}
			if (num)
			{
				messages.Add(ExportMessage.Info(blockDisplayName, blockType, "No changes: " + format.DisplayName));
				return (status: BlockExportStatus.Skipped, filePath: format.FilePath);
			}
			goto IL_00ac;
			IL_00ac:
			File.Copy(text, format.FilePath, overwrite: true);
			messages.Add(ExportMessage.Success(blockDisplayName, blockType, format.FilePath, "Updated: " + format.DisplayName));
			return (status: BlockExportStatus.Updated, filePath: format.FilePath);
		}
		finally
		{
			CleanupFile(text);
		}
	}

	private (BlockExportStatus status, string? filePath) ExportNewBlock(PlcBlock block, ExportFormatInfo format, string blockDisplayName, string blockType, string exportPath, PlcSoftware? plcSoftware, List<ExportMessage> messages)
	{
		if (format.EffectiveFormat == "scl" && plcSoftware != null && block != null)
		{
			ExportBlockAsSource(plcSoftware, block, format.FilePath);
		}
		else
		{
			block.Export(new FileInfo(format.FilePath), (ExportOptions)1);
		}
		messages.Add(ExportMessage.Success(blockDisplayName, blockType, format.FilePath, "Imported: " + format.DisplayName));
		return (status: BlockExportStatus.Exported, filePath: format.FilePath);
	}

	private void ExportBlockByFormat(PlcBlock block, string effectiveFormat, string filePath, PlcSoftware? plcSoftware)
	{
		if (effectiveFormat == "scl" && plcSoftware != null && block != null)
		{
			ExportBlockAsSource(plcSoftware, block, filePath);
		}
		else
		{
			block.Export(new FileInfo(filePath), (ExportOptions)1);
		}
	}

	private static void ExportBlockAsSource(PlcSoftware plcSoftware, PlcBlock block, string filePath)
	{
		PlcExternalSourceSystemGroup externalSourceGroup = plcSoftware.ExternalSourceGroup;
		List<IGenerateSource> list = new List<IGenerateSource> { (IGenerateSource)(object)block };
		externalSourceGroup.GenerateSource((IEnumerable<IGenerateSource>)list, new FileInfo(filePath), (GenerateOptions)0);
	}

	private static void CleanupDirectory(string path)
	{
		if (Directory.Exists(path))
		{
			Directory.Delete(path, recursive: true);
		}
	}

	private static void CleanupFile(string path)
	{
		if (File.Exists(path))
		{
			File.Delete(path);
		}
	}

	public async Task<object> ExportBlocksAsync(ProjectBase? currentProject, string deviceId, string exportPath, TiaExportOptions options)
	{
		return await Task.Run(delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			int successCount = 0;
			int errorCount = 0;
			int skippedCount = 0;
			try
			{
				var (val, obj) = ResolveDevicePlcSoftware(currentProject, deviceId);
				if (obj != null)
				{
					return obj;
				}
				if (val.BlockGroup == null)
				{
					return MakeError("Block group not found in PLC software");
				}
				string text = Path.Combine(exportPath, "Program blocks");
				Directory.CreateDirectory(text);
				try
				{
					ExportBlockGroupWithMessages((PlcBlockGroup)(object)val.BlockGroup, text, options, list, ref successCount, ref errorCount, ref skippedCount, val);
				}
				catch (Exception ex)
				{
					list.Add(ExportMessage.Error("ImportBlocks", "BlockGroup", "Error during block import: " + ex.Message, ex.ToString()));
					return new
					{
						success = false,
						error = "Error importing blocks: " + ex.Message,
						itemCount = successCount,
						successCount = successCount,
						errorCount = errorCount + 1,
						skippedCount = skippedCount,
						messages = list
					};
				}
				return new
				{
					success = true,
					itemCount = successCount,
					successCount = successCount,
					errorCount = errorCount,
					skippedCount = skippedCount,
					messages = list
				};
			}
			catch (Exception ex2)
			{
				list.Add(ExportMessage.Error("ImportBlocks", "Operation", ex2.Message, ex2.ToString()));
				return new
				{
					success = false,
					error = ex2.Message,
					messages = list
				};
			}
		});
	}

	public void ExportBlockGroupWithMessages(PlcBlockGroup group, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount, PlcSoftware? plcSoftware = null)
	{
		Directory.CreateDirectory(exportPath);
		foreach (PlcBlock block in group.Blocks)
		{
			switch (ExportSingleBlockToFile(block, exportPath, options, messages, plcSoftware).status)
			{
			case BlockExportStatus.Exported:
			case BlockExportStatus.Updated:
				successCount++;
				break;
			case BlockExportStatus.Skipped:
				skippedCount++;
				break;
			case BlockExportStatus.Error:
				errorCount++;
				break;
			}
		}
		foreach (PlcBlockUserGroup group2 in group.Groups)
		{
			string exportPath2 = Path.Combine(exportPath, group2.Name);
			ExportBlockGroupWithMessages((PlcBlockGroup)(object)group2, exportPath2, options, messages, ref successCount, ref errorCount, ref skippedCount, plcSoftware);
		}
		DeleteOrphanedItems(group, exportPath, options, messages);
	}

	public int ExportBlockGroup(PlcBlockGroup group, string exportPath, TiaExportOptions options)
	{
		List<ExportMessage> messages = new List<ExportMessage>();
		int successCount = 0;
		int errorCount = 0;
		int skippedCount = 0;
		ExportBlockGroupWithMessages(group, exportPath, options, messages, ref successCount, ref errorCount, ref skippedCount);
		return successCount;
	}

	public async Task<object> ExportBlockGroupAsync(ProjectBase? currentProject, string deviceId, string groupId, string exportPath, TiaExportOptions options)
	{
		return await Task.Run(delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			int successCount = 0;
			int errorCount = 0;
			int skippedCount = 0;
			try
			{
				var (val, obj) = ResolveDevicePlcSoftware(currentProject, deviceId);
				if (obj != null)
				{
					return obj;
				}
				PlcBlockGroup val2 = FindBlockGroupById((PlcBlockGroup)(object)val.BlockGroup, groupId);
				if (val2 == null)
				{
					return MakeError("Block group '" + groupId + "' not found");
				}
				string text = Path.Combine(exportPath, val2.Name);
				Directory.CreateDirectory(text);
				ExportBlockGroupWithMessages(val2, text, options, list, ref successCount, ref errorCount, ref skippedCount, val);
				return new
				{
					success = true,
					itemCount = successCount,
					successCount = successCount,
					errorCount = errorCount,
					skippedCount = skippedCount,
					filePath = text,
					messages = list
				};
			}
			catch (Exception ex)
			{
				list.Add(ExportMessage.Error("ImportBlockGroup", "Operation", ex.Message, ex.ToString()));
				return new
				{
					success = false,
					error = ex.Message,
					messages = list
				};
			}
		});
	}

	public async Task<object> ExportBlockGroupWithPathAsync(ProjectBase? currentProject, string deviceId, string groupName, string groupPath, string exportPath, TiaExportOptions options)
	{
		return await Task.Run(delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			int successCount = 0;
			int errorCount = 0;
			int skippedCount = 0;
			try
			{
				var (val, obj) = ResolveDevicePlcSoftware(currentProject, deviceId);
				if (obj != null)
				{
					return obj;
				}
				PlcBlockGroup val2 = FindBlockGroupByName((PlcBlockGroup)(object)val.BlockGroup, groupName);
				if (val2 == null)
				{
					return MakeError("Block group '" + groupName + "' not found");
				}
				string text = ResolveExportPath(exportPath, groupPath);
				Directory.CreateDirectory(text);
				ExportBlockGroupWithMessages(val2, text, options, list, ref successCount, ref errorCount, ref skippedCount, val);
				return new
				{
					success = true,
					itemCount = successCount,
					successCount = successCount,
					errorCount = errorCount,
					skippedCount = skippedCount,
					filePath = text,
					messages = list
				};
			}
			catch (Exception ex)
			{
				list.Add(ExportMessage.Error("ImportBlockGroupWithPath", "Operation", ex.Message, ex.ToString()));
				return new
				{
					success = false,
					error = ex.Message,
					messages = list
				};
			}
		});
	}

	public async Task<object> ExportBlockAsync(ProjectBase? currentProject, string deviceId, string blockId, string exportPath, TiaExportOptions options)
	{
		return await Task.Run(delegate
		{
			//IL_013c: Expected O, but got Unknown
			List<ExportMessage> list = new List<ExportMessage>();
			try
			{
				var (val, obj) = ResolveDevicePlcSoftware(currentProject, deviceId);
				if (obj != null)
				{
					return obj;
				}
				string text = blockId.Split('/').Last();
				PlcBlock val2 = FindBlock((PlcBlockGroup)(object)val.BlockGroup, text);
				if (val2 == null)
				{
					return MakeError("Block '" + text + "' not found");
				}
				var (blockExportStatus, text2) = ExportSingleBlockToFile(val2, exportPath, options, list, val);
				if (blockExportStatus == BlockExportStatus.Error)
				{
					ExportMessage exportMessage = list.LastOrDefault((ExportMessage m) => m.Type == "error");
					return new
					{
						success = false,
						error = (exportMessage?.Details ?? exportMessage?.Message ?? "Export failed"),
						messages = list
					};
				}
				string filePath = text2;
				bool flag = (uint)blockExportStatus <= 1u;
				return new
				{
					success = true,
					filePath = filePath,
					successCount = (flag ? 1 : 0),
					skippedCount = ((blockExportStatus == BlockExportStatus.Skipped) ? 1 : 0),
					messages = list
				};
			}
			catch (EngineeringException ex)
			{
				EngineeringException ex2 = ex;
				string text3 = ExtractTiaErrorDetails(ex2);
				list.Add(ExportMessage.Error(blockId, "Block", "TIA Portal error: " + ((Exception)(object)ex2).Message, text3));
				return new
				{
					success = false,
					error = text3,
					messages = list
				};
			}
			catch (Exception ex3)
			{
				list.Add(ExportMessage.Error(blockId, "Block", ex3.Message, ex3.ToString()));
				return new
				{
					success = false,
					error = ex3.Message,
					messages = list
				};
			}
		});
	}

	public async Task<object> ExportBlockWithPathAsync(ProjectBase? currentProject, string deviceId, string blockId, string groupPath, string exportPath, TiaExportOptions options)
	{
		return await Task.Run(delegate
		{
			//IL_014b: Expected O, but got Unknown
			List<ExportMessage> list = new List<ExportMessage>();
			try
			{
				var (val, obj) = ResolveDevicePlcSoftware(currentProject, deviceId);
				if (obj != null)
				{
					return obj;
				}
				string text = blockId.Split('/').Last();
				PlcBlock val2 = FindBlock((PlcBlockGroup)(object)val.BlockGroup, text);
				if (val2 == null)
				{
					return MakeError("Block '" + text + "' not found");
				}
				string exportPath2 = ResolveExportPath(exportPath, groupPath);
				var (blockExportStatus, text2) = ExportSingleBlockToFile(val2, exportPath2, options, list, val);
				if (blockExportStatus == BlockExportStatus.Error)
				{
					ExportMessage exportMessage = list.LastOrDefault((ExportMessage m) => m.Type == "error");
					return new
					{
						success = false,
						error = (exportMessage?.Details ?? exportMessage?.Message ?? "Export failed"),
						messages = list
					};
				}
				string filePath = text2;
				bool flag = (uint)blockExportStatus <= 1u;
				return new
				{
					success = true,
					filePath = filePath,
					successCount = (flag ? 1 : 0),
					skippedCount = ((blockExportStatus == BlockExportStatus.Skipped) ? 1 : 0),
					messages = list
				};
			}
			catch (EngineeringException ex)
			{
				EngineeringException ex2 = ex;
				string text3 = ExtractTiaErrorDetails(ex2);
				list.Add(ExportMessage.Error(blockId, "Block", "TIA Portal error: " + ((Exception)(object)ex2).Message, text3));
				return new
				{
					success = false,
					error = text3,
					messages = list
				};
			}
			catch (Exception ex3)
			{
				list.Add(ExportMessage.Error(blockId, "Block", ex3.Message, ex3.ToString()));
				return new
				{
					success = false,
					error = ex3.Message,
					messages = list
				};
			}
		});
	}

	private void DeleteOrphanedItems(PlcBlockGroup group, string exportPath, TiaExportOptions options, List<ExportMessage> messages)
	{
		if (options.DeleteOrphanedFolders && Directory.Exists(exportPath))
		{
			DeleteOrphanedFiles(group, exportPath, options, messages);
			DeleteOrphanedFolders(group, exportPath, messages);
		}
	}

	private void DeleteOrphanedFiles(PlcBlockGroup group, string exportPath, TiaExportOptions options, List<ExportMessage> messages)
	{
		try
		{
			HashSet<string> hashSet = new HashSet<string>(from b in (IEnumerable<PlcBlock>)@group.Blocks
				where !options.ExcludeSystemBlocks || !IsSystemBlock(b)
				select b.Name, StringComparer.OrdinalIgnoreCase);
			string[] files = Directory.GetFiles(exportPath);
			foreach (string path in files)
			{
				string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(path);
				if (!hashSet.Contains(fileNameWithoutExtension))
				{
					try
					{
						string fileName = Path.GetFileName(path);
						File.Delete(path);
						messages.Add(ExportMessage.Deleted(fileNameWithoutExtension, "Block", "Deleted orphaned file: " + fileName));
					}
					catch (Exception ex)
					{
						messages.Add(ExportMessage.Warning(fileNameWithoutExtension, "Block", "Failed to delete orphaned file: " + Path.GetFileName(path), ex.Message));
					}
				}
			}
		}
		catch (Exception ex2)
		{
			messages.Add(ExportMessage.Warning("OrphanCleanup", "Block", "Failed to check for orphaned files in: " + exportPath, ex2.Message));
		}
	}

	private static void DeleteOrphanedFolders(PlcBlockGroup group, string exportPath, List<ExportMessage> messages)
	{
		try
		{
			HashSet<string> hashSet = new HashSet<string>(((IEnumerable<PlcBlockUserGroup>)group.Groups).Select((PlcBlockUserGroup g) => g.Name), StringComparer.OrdinalIgnoreCase);
			string[] directories = Directory.GetDirectories(exportPath);
			foreach (string path in directories)
			{
				string fileName = Path.GetFileName(path);
				if (!hashSet.Contains(fileName))
				{
					try
					{
						Directory.Delete(path, recursive: true);
						messages.Add(ExportMessage.Deleted(fileName, "Folder", "Deleted orphaned folder: " + fileName));
					}
					catch (Exception ex)
					{
						messages.Add(ExportMessage.Warning(fileName, "Folder", "Failed to delete orphaned folder: " + fileName, ex.Message));
					}
				}
			}
		}
		catch (Exception ex2)
		{
			messages.Add(ExportMessage.Warning("OrphanCleanup", "Folder", "Failed to check for orphaned folders in: " + exportPath, ex2.Message));
		}
	}

	public PlcBlockGroup? FindBlockGroupById(PlcBlockGroup group, string groupId)
	{
		if (group.Name == groupId || GenerateGroupId(group) == groupId)
		{
			return group;
		}
		foreach (PlcBlockUserGroup group2 in group.Groups)
		{
			PlcBlockGroup val = FindBlockGroupById((PlcBlockGroup)(object)group2, groupId);
			if (val != null)
			{
				return val;
			}
		}
		return null;
	}

	public PlcBlockGroup? FindBlockGroupByName(PlcBlockGroup group, string groupName)
	{
		if (group.Name == groupName)
		{
			return group;
		}
		foreach (PlcBlockUserGroup group2 in group.Groups)
		{
			if (group2.Name == groupName)
			{
				return (PlcBlockGroup?)(object)group2;
			}
			PlcBlockGroup val = FindBlockGroupByName((PlcBlockGroup)(object)group2, groupName);
			if (val != null)
			{
				return val;
			}
		}
		return null;
	}

	public PlcBlock? FindBlock(PlcBlockGroup group, string blockName)
	{
		PlcBlock val = ((IEnumerable<PlcBlock>)group.Blocks).FirstOrDefault((PlcBlock b) => b.Name == blockName);
		if (val != null)
		{
			return val;
		}
		foreach (PlcBlockUserGroup group2 in group.Groups)
		{
			val = FindBlock((PlcBlockGroup)(object)group2, blockName);
			if (val != null)
			{
				return val;
			}
		}
		return null;
	}

	private static string GenerateGroupId(PlcBlockGroup group)
	{
		return "group_" + group.Name.Replace(" ", "_");
	}

	public static string GetBlockType(PlcBlock block)
	{
		if (!(block is OB))
		{
			if (!(block is FB))
			{
				if (!(block is FC))
				{
					if (!(block is InstanceDB))
					{
						if (block is DataBlock)
						{
							return "DB";
						}
						return "Block";
					}
					return "InstanceDB";
				}
				return "FC";
			}
			return "FB";
		}
		return "OB";
	}

	private static bool IsSystemBlock(PlcBlock block)
	{
		try
		{
			string text = block.Name.ToUpper();
			return text.StartsWith("SFC") || text.StartsWith("SFB") || text.StartsWith("SSC") || text.StartsWith("SSB");
		}
		catch
		{
			return false;
		}
	}

	private static bool IsKnowHowProtected(PlcBlock block)
	{
		try
		{
			return block.IsKnowHowProtected;
		}
		catch
		{
			return false;
		}
	}

	private static (string filePath, bool alreadyExisted) GenerateProtectedBlockXml(PlcBlock block, string exportPath)
	{
		//IL_004f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0054: Unknown result type (might be due to invalid IL or missing references)
		string blockType = GetBlockType(block);
		string path = block.Name + ".xml";
		string text = Path.Combine(exportPath, path);
		if (File.Exists(text))
		{
			try
			{
				if (File.ReadAllText(text).Contains("<KnowHowProtectedBlock>"))
				{
					return (filePath: text, alreadyExisted: true);
				}
			}
			catch
			{
			}
		}
		string text2;
		try
		{
			text2 = ((object)block.ProgrammingLanguage/*cast due to constrained. prefix*/).ToString();
		}
		catch
		{
			text2 = "Unknown";
		}
		string contents = $"<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<!--\r\n  Know-How Protected Block Placeholder\r\n  =====================================\r\n  This block is know-how protected in TIA Portal and cannot be exported as source code.\r\n  This file serves as a placeholder to maintain the project folder structure.\r\n\r\n  To export the full block content:\r\n  1. Open the block in TIA Portal\r\n  2. Remove know-how protection (Properties > Protection)\r\n  3. Re-import the block\r\n-->\r\n<KnowHowProtectedBlock>\r\n  <Name>{SecurityElement.Escape(block.Name)}</Name>\r\n  <Type>{blockType}</Type>\r\n  <Number>{block.Number}</Number>\r\n  <ProgrammingLanguage>{text2}</ProgrammingLanguage>\r\n  <IsKnowHowProtected>true</IsKnowHowProtected>\r\n  <ExportDate>{DateTime.Now:yyyy-MM-dd HH:mm:ss}</ExportDate>\r\n</KnowHowProtectedBlock>\r\n";
		Directory.CreateDirectory(exportPath);
		File.WriteAllText(text, contents, Encoding.UTF8);
		return (filePath: text, alreadyExisted: false);
	}

	private static string ExtractTiaErrorDetails(EngineeringException ex)
	{
		List<string> list = new List<string> { "Error: " + ((Exception)(object)ex).Message };
		Exception innerException = ((Exception)(object)ex).InnerException;
		int num = 0;
		while (innerException != null && num < 5)
		{
			list.Add("Caused by: " + innerException.Message);
			innerException = innerException.InnerException;
			num++;
		}
		string text = ((Exception)(object)ex).Message.ToLower();
		if (text.Contains("protected") || text.Contains("know-how"))
		{
			list.Add("");
			list.Add("Solution: Remove know-how protection from the block in TIA Portal before exporting.");
		}
		else if (text.Contains("access") || text.Contains("permission"))
		{
			list.Add("");
			list.Add("Solution: Ensure you have sufficient permissions and TIA Portal is running with appropriate access rights.");
		}
		else if (text.Contains("compile") || text.Contains("consistency"))
		{
			list.Add("");
			list.Add("Solution: Compile the block in TIA Portal to resolve any inconsistencies before exporting.");
		}
		else if (text.Contains("not found") || text.Contains("does not exist"))
		{
			list.Add("");
			list.Add("Solution: Verify the item exists in the TIA Portal project. The project may need to be refreshed.");
		}
		return string.Join("\n", list);
	}
}

