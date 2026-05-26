using System;
using System.Collections.Generic;
using System.Linq;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using Siemens.Engineering.Hmi;
using Siemens.Engineering.Hmi.Communication;
using Siemens.Engineering.Hmi.Screen;
using Siemens.Engineering.Hmi.Tag;
using Siemens.Engineering.HmiUnified;
using Siemens.Engineering.HmiUnified.HmiConnections;
using Siemens.Engineering.HmiUnified.HmiTags;
using Siemens.Engineering.HmiUnified.UI.Base;
using Siemens.Engineering.HmiUnified.UI.ScreenGroup;
using Siemens.Engineering.HmiUnified.UI.Screens;
using Siemens.Engineering.Library;
using Siemens.Engineering.Library.MasterCopies;
using Siemens.Engineering.Library.Types;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.Tags;
using Siemens.Engineering.SW.Types;
using Siemens.Engineering.SW.WatchAndForceTables;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services;

public class ProjectStructureBuilder
{
	public TiaProjectInfo BuildProjectStructure(ProjectBase project, string? projectId = null)
	{
		TiaProjectInfo tiaProjectInfo = new TiaProjectInfo
		{
			Id = (projectId ?? (project.Path?.FullName ?? project.Name)),
			Name = project.Name,
			Path = (project.Path?.FullName ?? ""),
			Version = GetProjectVersion(project),
			Devices = new List<TiaDeviceInfo>()
		};
		foreach (Device device in project.Devices)
		{
			TiaDeviceInfo tiaDeviceInfo = BuildDeviceStructure(device);
			if (tiaDeviceInfo != null)
			{
				tiaProjectInfo.Devices.Add(tiaDeviceInfo);
			}
		}
		try
		{
			DeviceSystemGroup ungroupedDevicesGroup = project.UngroupedDevicesGroup;
			if (((ungroupedDevicesGroup != null) ? ((DeviceGroup)ungroupedDevicesGroup).Devices : null) != null)
			{
				foreach (Device device2 in ((DeviceGroup)project.UngroupedDevicesGroup).Devices)
				{
					TiaDeviceInfo tiaDeviceInfo2 = BuildDeviceStructure(device2);
					if (tiaDeviceInfo2 != null)
					{
						tiaProjectInfo.Devices.Add(tiaDeviceInfo2);
					}
				}
			}
		}
		catch
		{
		}
		tiaProjectInfo.Devices = tiaProjectInfo.Devices.OrderBy<TiaDeviceInfo, string>((TiaDeviceInfo d) => d.DisplayName ?? d.Name, StringComparer.OrdinalIgnoreCase).ToList();
		try
		{
			tiaProjectInfo.Library = BuildLibraryStructure(project);
		}
		catch
		{
			tiaProjectInfo.Library = null;
		}
		try
		{
			tiaProjectInfo.LibraryTypes = BuildLibraryTypesStructure(project);
		}
		catch
		{
			tiaProjectInfo.LibraryTypes = null;
		}
		return tiaProjectInfo;
	}

	public TiaLibraryFolderInfo? BuildLibraryStructure(ProjectBase project)
	{
		ProjectLibrary val = null;
		try
		{
			val = project.ProjectLibrary;
		}
		catch
		{
			return null;
		}
		if (val == null)
		{
			return null;
		}
		MasterCopySystemFolder val2 = null;
		try
		{
			val2 = val.MasterCopyFolder;
		}
		catch
		{
			return null;
		}
		if (val2 == null)
		{
			return null;
		}
		TiaLibraryFolderInfo tiaLibraryFolderInfo = BuildLibraryFolderRecursive((MasterCopyFolder)(object)val2, "Master copies", "Library", null);
		if (tiaLibraryFolderInfo.Folders.Count == 0 && tiaLibraryFolderInfo.MasterCopies.Count == 0)
		{
			return null;
		}
		return tiaLibraryFolderInfo;
	}

	private TiaLibraryFolderInfo BuildLibraryFolderRecursive(MasterCopyFolder folder, string folderName, string parentPath, string? parentId)
	{
		string text = parentPath + "/" + folderName;
		TiaLibraryFolderInfo tiaLibraryFolderInfo = new TiaLibraryFolderInfo
		{
			Id = text,
			Name = folderName,
			ParentId = parentId,
			Folders = new List<TiaLibraryFolderInfo>(),
			MasterCopies = new List<TiaMasterCopyInfo>()
		};
		try
		{
			foreach (MasterCopyUserFolder folder2 in folder.Folders)
			{
				string text2 = folder2.Name ?? "";
				if (!string.IsNullOrEmpty(text2))
				{
					tiaLibraryFolderInfo.Folders.Add(BuildLibraryFolderRecursive((MasterCopyFolder)(object)folder2, text2, text, text));
				}
			}
		}
		catch
		{
		}
		try
		{
			foreach (MasterCopy masterCopy in folder.MasterCopies)
			{
				TiaMasterCopyInfo tiaMasterCopyInfo = BuildMasterCopyInfo(masterCopy, text);
				if (tiaMasterCopyInfo != null)
				{
					tiaLibraryFolderInfo.MasterCopies.Add(tiaMasterCopyInfo);
				}
			}
		}
		catch
		{
		}
		tiaLibraryFolderInfo.Folders = tiaLibraryFolderInfo.Folders.OrderBy<TiaLibraryFolderInfo, string>((TiaLibraryFolderInfo f) => f.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaLibraryFolderInfo.MasterCopies = tiaLibraryFolderInfo.MasterCopies.OrderBy<TiaMasterCopyInfo, string>((TiaMasterCopyInfo m) => m.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaLibraryFolderInfo;
	}

	private TiaMasterCopyInfo? BuildMasterCopyInfo(MasterCopy mc, string parentId)
	{
		string text;
		try
		{
			text = mc.Name ?? "";
		}
		catch
		{
			return null;
		}
		if (string.IsNullOrEmpty(text))
		{
			return null;
		}
		TiaMasterCopyInfo tiaMasterCopyInfo = new TiaMasterCopyInfo
		{
			Id = parentId + "/" + text,
			Name = text,
			ParentId = parentId,
			ContentTypes = new List<string>()
		};
		try
		{
			tiaMasterCopyInfo.Author = mc.Author;
		}
		catch
		{
		}
		try
		{
			foreach (MasterCopyContentDescription contentDescription in mc.ContentDescriptions)
			{
				string text2 = null;
				try
				{
					text2 = contentDescription.ContentType?.FullName;
				}
				catch
				{
				}
				if (!string.IsNullOrEmpty(text2))
				{
					tiaMasterCopyInfo.ContentTypes.Add(text2);
				}
			}
		}
		catch
		{
		}
		tiaMasterCopyInfo.Kind = ClassifyMasterCopyKind(tiaMasterCopyInfo.ContentTypes);
		return tiaMasterCopyInfo;
	}

	private static string ClassifyMasterCopyKind(IReadOnlyList<string> contentTypes)
	{
		if (contentTypes == null || contentTypes.Count == 0)
		{
			return "Unknown";
		}
		HashSet<string> hashSet = new HashSet<string>(StringComparer.Ordinal);
		foreach (string contentType in contentTypes)
		{
			hashSet.Add(MapContentTypeToKind(contentType));
		}
		hashSet.Remove("Unknown");
		if (hashSet.Count == 0)
		{
			return "Unknown";
		}
		if (hashSet.Count == 1)
		{
			return hashSet.First();
		}
		return "Mixed";
	}

	private static string MapContentTypeToKind(string contentTypeFullName)
	{
		if (string.IsNullOrEmpty(contentTypeFullName))
		{
			return "Unknown";
		}
		if (contentTypeFullName.Contains(".SW.Blocks."))
		{
			return "Block";
		}
		if (contentTypeFullName.Contains(".SW.Types."))
		{
			return "DataType";
		}
		if (contentTypeFullName.Contains(".SW.Tags.PlcTagTable"))
		{
			return "TagTable";
		}
		if (contentTypeFullName.Contains(".SW.Tags."))
		{
			return "Tag";
		}
		if (contentTypeFullName.Contains(".SW.WatchAndForceTables."))
		{
			return "WatchTable";
		}
		if (contentTypeFullName.Contains(".Hmi.Screen.") || contentTypeFullName.Contains(".HmiUnified.UI."))
		{
			return "Screen";
		}
		if (contentTypeFullName.Contains(".Hmi.Tag.") || contentTypeFullName.Contains(".HmiUnified.HmiTags."))
		{
			return "Tag";
		}
		if (contentTypeFullName.Contains(".HW.Subnet"))
		{
			return "Subnet";
		}
		if (contentTypeFullName.Contains(".HW.Device") || contentTypeFullName.Contains(".HW.DeviceItem"))
		{
			return "Device";
		}
		return "Unknown";
	}

	public TiaLibraryTypeFolderInfo? BuildLibraryTypesStructure(ProjectBase project)
	{
		ProjectLibrary val = null;
		try
		{
			val = ((ProjectBase)project).ProjectLibrary;
		}
		catch
		{
			return null;
		}
		if (val == null)
		{
			return null;
		}
		LibraryTypeSystemFolder val2 = null;
		try
		{
			val2 = val.TypeFolder;
		}
		catch
		{
			return null;
		}
		if (val2 == null)
		{
			return null;
		}
		TiaLibraryTypeFolderInfo tiaLibraryTypeFolderInfo = BuildLibraryTypeFolderRecursive((LibraryTypeFolder)(object)val2, "Types", "Library", null);
		if (tiaLibraryTypeFolderInfo.Folders.Count == 0 && tiaLibraryTypeFolderInfo.Types.Count == 0)
		{
			return null;
		}
		return tiaLibraryTypeFolderInfo;
	}

	private TiaLibraryTypeFolderInfo BuildLibraryTypeFolderRecursive(LibraryTypeFolder folder, string folderName, string parentPath, string? parentId)
	{
		string text = parentPath + "/" + folderName;
		TiaLibraryTypeFolderInfo tiaLibraryTypeFolderInfo = new TiaLibraryTypeFolderInfo
		{
			Id = text,
			Name = folderName,
			ParentId = parentId,
			Folders = new List<TiaLibraryTypeFolderInfo>(),
			Types = new List<TiaLibraryTypeInfo>()
		};
		try
		{
			foreach (LibraryTypeUserFolder folder2 in folder.Folders)
			{
				string text2 = folder2.Name ?? "";
				if (!string.IsNullOrEmpty(text2))
				{
					tiaLibraryTypeFolderInfo.Folders.Add(BuildLibraryTypeFolderRecursive((LibraryTypeFolder)(object)folder2, text2, text, text));
				}
			}
		}
		catch
		{
		}
		try
		{
			foreach (LibraryType type in folder.Types)
			{
				TiaLibraryTypeInfo tiaLibraryTypeInfo = BuildLibraryTypeInfo(type, text);
				if (tiaLibraryTypeInfo != null)
				{
					tiaLibraryTypeFolderInfo.Types.Add(tiaLibraryTypeInfo);
				}
			}
		}
		catch
		{
		}
		tiaLibraryTypeFolderInfo.Folders = tiaLibraryTypeFolderInfo.Folders.OrderBy<TiaLibraryTypeFolderInfo, string>((TiaLibraryTypeFolderInfo f) => f.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaLibraryTypeFolderInfo.Types = tiaLibraryTypeFolderInfo.Types.OrderBy<TiaLibraryTypeInfo, string>((TiaLibraryTypeInfo t) => t.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaLibraryTypeFolderInfo;
	}

	private TiaLibraryTypeInfo? BuildLibraryTypeInfo(LibraryType type, string parentId)
	{
		string text;
		try
		{
			text = type.Name ?? "";
		}
		catch
		{
			return null;
		}
		if (string.IsNullOrEmpty(text))
		{
			return null;
		}
		TiaLibraryTypeInfo tiaLibraryTypeInfo = new TiaLibraryTypeInfo
		{
			Id = parentId + "/" + text,
			Name = text,
			ParentId = parentId
		};
		try
		{
			tiaLibraryTypeInfo.Namespace = type.Namespace;
		}
		catch
		{
		}
		try
		{
			tiaLibraryTypeInfo.Author = type.Author;
		}
		catch
		{
		}
		try
		{
			LibraryTypeVersionComposition versions = type.Versions;
			tiaLibraryTypeInfo.VersionCount = ((versions != null) ? versions.Count : 0);
		}
		catch
		{
			tiaLibraryTypeInfo.VersionCount = 0;
		}
		return tiaLibraryTypeInfo;
	}

	public TiaDeviceInfo? BuildDeviceStructure(Device device)
	{
		string deviceDisplayName = GetDeviceDisplayName(device);
		string text = ((!string.IsNullOrEmpty(deviceDisplayName)) ? deviceDisplayName : ((HardwareObject)device).Name);
		TiaDeviceInfo tiaDeviceInfo = new TiaDeviceInfo
		{
			Id = text,
			Name = ((HardwareObject)device).Name,
			DisplayName = deviceDisplayName,
			Type = "Device",
			PlcSoftware = new List<TiaPlcSoftwareInfo>(),
			HmiSoftware = new List<TiaHmiSoftwareInfo>()
		};
		foreach (DeviceItem deviceItem in ((HardwareObject)device).DeviceItems)
		{
			PlcSoftware plcSoftwareFromItem = GetPlcSoftwareFromItem(deviceItem);
			if (plcSoftwareFromItem != null)
			{
				tiaDeviceInfo.PlcSoftware.Add(BuildPlcSoftwareStructure(plcSoftwareFromItem, text));
			}
			TiaHmiSoftwareInfo hmiSoftwareFromItem = GetHmiSoftwareFromItem(deviceItem);
			if (hmiSoftwareFromItem != null)
			{
				tiaDeviceInfo.HmiSoftware.Add(hmiSoftwareFromItem);
			}
		}
		tiaDeviceInfo.Type = DetermineDeviceType(device, tiaDeviceInfo);
		return tiaDeviceInfo;
	}

	public TiaPlcSoftwareInfo BuildPlcSoftwareStructure(PlcSoftware plcSoftware, string deviceId)
	{
		string text = deviceId + "/" + plcSoftware.Name;
		TiaPlcSoftwareInfo tiaPlcSoftwareInfo = new TiaPlcSoftwareInfo
		{
			Id = text,
			Name = plcSoftware.Name,
			BlockGroups = new List<TiaBlockGroupInfo>(),
			TagTableGroups = new List<TiaTagTableGroupInfo>(),
			UdtGroups = new List<TiaUdtGroupInfo>(),
			WatchTableGroups = new List<TiaWatchTableGroupInfo>(),
			TagTables = new List<TiaTagTableInfo>(),
			UserDataTypes = new List<TiaUdtInfo>(),
			WatchTables = new List<TiaWatchTableInfo>()
		};
		tiaPlcSoftwareInfo.BlockGroups.Add(BuildBlockGroupStructure((PlcBlockGroup)(object)plcSoftware.BlockGroup, "Program blocks", text));
		tiaPlcSoftwareInfo.TagTableGroups.Add(BuildTagTableGroupStructure((PlcTagTableGroup)(object)plcSoftware.TagTableGroup, "PLC tags", text));
		tiaPlcSoftwareInfo.UdtGroups.Add(BuildUdtGroupStructure((PlcTypeGroup)(object)plcSoftware.TypeGroup, "PLC data types", text));
		tiaPlcSoftwareInfo.WatchTableGroups.Add(BuildWatchTableGroupStructure((PlcWatchAndForceTableGroup)(object)plcSoftware.WatchAndForceTableGroup, "Watch and force tables", text));
		AddTagTablesRecursively((PlcTagTableGroup)(object)plcSoftware.TagTableGroup, tiaPlcSoftwareInfo.TagTables, text);
		AddUserDataTypesRecursively((PlcTypeGroup)(object)plcSoftware.TypeGroup, tiaPlcSoftwareInfo.UserDataTypes, text);
		AddWatchTablesRecursively((PlcWatchAndForceTableGroup)(object)plcSoftware.WatchAndForceTableGroup, tiaPlcSoftwareInfo.WatchTables, text);
		return tiaPlcSoftwareInfo;
	}

	public TiaBlockGroupInfo BuildBlockGroupStructure(PlcBlockGroup group, string name, string plcIdPrefix)
	{
		string text = plcIdPrefix + "/" + name;
		TiaBlockGroupInfo tiaBlockGroupInfo = new TiaBlockGroupInfo
		{
			Id = text,
			Name = name,
			Blocks = new List<TiaBlockInfo>(),
			SubGroups = new List<TiaBlockGroupInfo>()
		};
		foreach (PlcBlock block in group.Blocks)
		{
			TiaBlockInfo tiaBlockInfo = new TiaBlockInfo
			{
				Id = text + "/" + block.Name,
				Name = block.Name,
				Type = GetBlockType(block),
				Number = GetBlockNumber(block),
				Language = GetBlockLanguage(block)
			};
			InstanceDB val = (InstanceDB)(object)((block is InstanceDB) ? block : null);
			if (val != null)
			{
				try
				{
					tiaBlockInfo.InstanceOfFb = val.InstanceOfName;
				}
				catch
				{
				}
			}
			tiaBlockGroupInfo.Blocks.Add(tiaBlockInfo);
		}
		foreach (PlcBlockUserGroup group2 in group.Groups)
		{
			tiaBlockGroupInfo.SubGroups.Add(BuildBlockGroupStructure((PlcBlockGroup)(object)group2, group2.Name, text));
		}
		tiaBlockGroupInfo.Blocks = tiaBlockGroupInfo.Blocks.OrderBy<TiaBlockInfo, string>((TiaBlockInfo b) => b.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaBlockGroupInfo.SubGroups = tiaBlockGroupInfo.SubGroups.OrderBy<TiaBlockGroupInfo, string>((TiaBlockGroupInfo g) => g.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaBlockGroupInfo;
	}

	public TiaTagTableGroupInfo BuildTagTableGroupStructure(PlcTagTableGroup group, string name, string plcIdPrefix)
	{
		string text = plcIdPrefix + "/" + name;
		TiaTagTableGroupInfo tiaTagTableGroupInfo = new TiaTagTableGroupInfo
		{
			Id = text,
			Name = name,
			TagTables = new List<TiaTagTableInfo>(),
			SubGroups = new List<TiaTagTableGroupInfo>()
		};
		foreach (PlcTagTable tagTable in group.TagTables)
		{
			tiaTagTableGroupInfo.TagTables.Add(new TiaTagTableInfo
			{
				Id = text + "/" + tagTable.Name,
				Name = tagTable.Name,
				TagCount = tagTable.Tags.Count
			});
		}
		foreach (PlcTagTableUserGroup group2 in group.Groups)
		{
			tiaTagTableGroupInfo.SubGroups.Add(BuildTagTableGroupStructure((PlcTagTableGroup)(object)group2, group2.Name, text));
		}
		tiaTagTableGroupInfo.TagTables = tiaTagTableGroupInfo.TagTables.OrderBy<TiaTagTableInfo, string>((TiaTagTableInfo t) => t.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaTagTableGroupInfo.SubGroups = tiaTagTableGroupInfo.SubGroups.OrderBy<TiaTagTableGroupInfo, string>((TiaTagTableGroupInfo g) => g.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaTagTableGroupInfo;
	}

	public TiaUdtGroupInfo BuildUdtGroupStructure(PlcTypeGroup group, string name, string plcIdPrefix)
	{
		string text = plcIdPrefix + "/" + name;
		TiaUdtGroupInfo tiaUdtGroupInfo = new TiaUdtGroupInfo
		{
			Id = text,
			Name = name,
			Udts = new List<TiaUdtInfo>(),
			SubGroups = new List<TiaUdtGroupInfo>()
		};
		foreach (PlcType type in group.Types)
		{
			tiaUdtGroupInfo.Udts.Add(new TiaUdtInfo
			{
				Id = text + "/" + type.Name,
				Name = type.Name
			});
		}
		foreach (PlcTypeUserGroup group2 in group.Groups)
		{
			tiaUdtGroupInfo.SubGroups.Add(BuildUdtGroupStructure((PlcTypeGroup)(object)group2, group2.Name, text));
		}
		tiaUdtGroupInfo.Udts = tiaUdtGroupInfo.Udts.OrderBy<TiaUdtInfo, string>((TiaUdtInfo u) => u.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaUdtGroupInfo.SubGroups = tiaUdtGroupInfo.SubGroups.OrderBy<TiaUdtGroupInfo, string>((TiaUdtGroupInfo g) => g.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaUdtGroupInfo;
	}

	public TiaWatchTableGroupInfo BuildWatchTableGroupStructure(PlcWatchAndForceTableGroup group, string name, string plcIdPrefix)
	{
		string text = plcIdPrefix + "/" + name;
		TiaWatchTableGroupInfo tiaWatchTableGroupInfo = new TiaWatchTableGroupInfo
		{
			Id = text,
			Name = name,
			WatchTables = new List<TiaWatchTableInfo>(),
			SubGroups = new List<TiaWatchTableGroupInfo>()
		};
		foreach (PlcWatchTable watchTable in group.WatchTables)
		{
			tiaWatchTableGroupInfo.WatchTables.Add(new TiaWatchTableInfo
			{
				Id = text + "/" + watchTable.Name,
				Name = watchTable.Name
			});
		}
		foreach (PlcWatchAndForceTableUserGroup group2 in group.Groups)
		{
			tiaWatchTableGroupInfo.SubGroups.Add(BuildWatchTableGroupStructure((PlcWatchAndForceTableGroup)(object)group2, group2.Name, text));
		}
		tiaWatchTableGroupInfo.WatchTables = tiaWatchTableGroupInfo.WatchTables.OrderBy<TiaWatchTableInfo, string>((TiaWatchTableInfo w) => w.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaWatchTableGroupInfo.SubGroups = tiaWatchTableGroupInfo.SubGroups.OrderBy<TiaWatchTableGroupInfo, string>((TiaWatchTableGroupInfo g) => g.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaWatchTableGroupInfo;
	}

	private void AddTagTablesRecursively(PlcTagTableGroup group, List<TiaTagTableInfo> tagTables, string plcIdPrefix)
	{
		foreach (PlcTagTable tagTable in group.TagTables)
		{
			tagTables.Add(new TiaTagTableInfo
			{
				Id = plcIdPrefix + "/PLC tags/" + tagTable.Name,
				Name = tagTable.Name,
				TagCount = tagTable.Tags.Count
			});
		}
		foreach (PlcTagTableUserGroup group2 in group.Groups)
		{
			AddTagTablesRecursively((PlcTagTableGroup)(object)group2, tagTables, plcIdPrefix);
		}
	}

	private void AddUserDataTypesRecursively(PlcTypeGroup group, List<TiaUdtInfo> udts, string plcIdPrefix)
	{
		foreach (PlcType type in group.Types)
		{
			udts.Add(new TiaUdtInfo
			{
				Id = plcIdPrefix + "/PLC data types/" + type.Name,
				Name = type.Name
			});
		}
		foreach (PlcTypeUserGroup group2 in group.Groups)
		{
			AddUserDataTypesRecursively((PlcTypeGroup)(object)group2, udts, plcIdPrefix);
		}
	}

	private void AddWatchTablesRecursively(PlcWatchAndForceTableGroup group, List<TiaWatchTableInfo> watchTables, string plcIdPrefix)
	{
		foreach (PlcWatchTable watchTable in group.WatchTables)
		{
			watchTables.Add(new TiaWatchTableInfo
			{
				Id = plcIdPrefix + "/Watch and force tables/" + watchTable.Name,
				Name = watchTable.Name
			});
		}
		foreach (PlcWatchAndForceTableUserGroup group2 in group.Groups)
		{
			AddWatchTablesRecursively((PlcWatchAndForceTableGroup)(object)group2, watchTables, plcIdPrefix);
		}
	}

	public PlcSoftware? GetPlcSoftwareFromItem(DeviceItem item)
	{
		SoftwareContainer service = item.GetService<SoftwareContainer>();
		Software obj = ((service != null) ? service.Software : null);
		PlcSoftware val = (PlcSoftware)(object)((obj is PlcSoftware) ? obj : null);
		if (val != null)
		{
			return val;
		}
		foreach (DeviceItem deviceItem in ((HardwareObject)item).DeviceItems)
		{
			PlcSoftware plcSoftwareFromItem = GetPlcSoftwareFromItem(deviceItem);
			if (plcSoftwareFromItem != null)
			{
				return plcSoftwareFromItem;
			}
		}
		return null;
	}

	public TiaHmiSoftwareInfo? GetHmiSoftwareFromItem(DeviceItem item)
	{
		try
		{
			SoftwareContainer service = item.GetService<SoftwareContainer>();
			if (((service != null) ? service.Software : null) != null)
			{
				Software software = service.Software;
				HmiTarget val = (HmiTarget)(object)((software is HmiTarget) ? software : null);
				if (val != null)
				{
					return BuildHmiTargetStructure(val);
				}
				Software software2 = service.Software;
				HmiSoftware val2 = (HmiSoftware)(object)((software2 is HmiSoftware) ? software2 : null);
				if (val2 != null)
				{
					return BuildHmiUnifiedStructure(val2);
				}
			}
		}
		catch
		{
		}
		foreach (DeviceItem deviceItem in ((HardwareObject)item).DeviceItems)
		{
			TiaHmiSoftwareInfo hmiSoftwareFromItem = GetHmiSoftwareFromItem(deviceItem);
			if (hmiSoftwareFromItem != null)
			{
				return hmiSoftwareFromItem;
			}
		}
		return null;
	}

	private TiaHmiSoftwareInfo BuildHmiTargetStructure(HmiTarget hmiTarget)
	{
		string name = hmiTarget.Name;
		TiaHmiSoftwareInfo tiaHmiSoftwareInfo = new TiaHmiSoftwareInfo
		{
			Id = name,
			Name = hmiTarget.Name,
			Type = "Classic",
			ScreenGroups = new List<TiaHmiScreenGroupInfo>(),
			TagGroups = new List<TiaHmiTagGroupInfo>(),
			Connections = new List<TiaHmiConnectionInfo>(),
			Screens = new List<TiaHmiScreenInfo>(),
			Tags = new List<TiaHmiTagInfo>()
		};
		try
		{
			if (hmiTarget.ScreenFolder != null)
			{
				tiaHmiSoftwareInfo.ScreenGroups.Add(BuildHmiScreenGroupStructure((ScreenFolder)(object)hmiTarget.ScreenFolder, "Screens", name));
			}
		}
		catch
		{
		}
		try
		{
			if (hmiTarget.TagFolder != null)
			{
				tiaHmiSoftwareInfo.TagGroups.Add(BuildHmiTagGroupStructure((TagFolder)(object)hmiTarget.TagFolder, "HMI tags", name));
			}
		}
		catch
		{
		}
		try
		{
			foreach (Connection connection in hmiTarget.Connections)
			{
				tiaHmiSoftwareInfo.Connections.Add(new TiaHmiConnectionInfo
				{
					Id = name + "/" + connection.Name,
					Name = connection.Name
				});
			}
		}
		catch
		{
		}
		return tiaHmiSoftwareInfo;
	}

	private TiaHmiSoftwareInfo BuildHmiUnifiedStructure(HmiSoftware hmiSoftware)
	{
		string text = "HMI_Unified";
		TiaHmiSoftwareInfo tiaHmiSoftwareInfo = new TiaHmiSoftwareInfo
		{
			Id = text,
			Name = "HMI_Unified",
			Type = "Unified",
			ScreenGroups = new List<TiaHmiScreenGroupInfo>(),
			TagGroups = new List<TiaHmiTagGroupInfo>(),
			Connections = new List<TiaHmiConnectionInfo>(),
			Screens = new List<TiaHmiScreenInfo>(),
			Tags = new List<TiaHmiTagInfo>()
		};
		try
		{
			foreach (HmiScreenGroup screenGroup in hmiSoftware.ScreenGroups)
			{
				tiaHmiSoftwareInfo.ScreenGroups.Add(BuildHmiUnifiedScreenGroupStructure(screenGroup, text));
			}
		}
		catch
		{
		}
		try
		{
			foreach (HmiScreen screen in hmiSoftware.Screens)
			{
				tiaHmiSoftwareInfo.Screens.Add(new TiaHmiScreenInfo
				{
					Id = text + "/" + ((HmiScreenBase)screen).Name,
					Name = ((HmiScreenBase)screen).Name,
					ScreenType = "Screen"
				});
			}
		}
		catch
		{
		}
		try
		{
			foreach (HmiTagTableGroup tagTableGroup in hmiSoftware.TagTableGroups)
			{
				tiaHmiSoftwareInfo.TagGroups.Add(BuildHmiUnifiedTagTableGroupStructure(tagTableGroup, text));
			}
		}
		catch
		{
		}
		try
		{
			foreach (HmiTagTable tagTable in hmiSoftware.TagTables)
			{
				foreach (HmiTag tag in tagTable.Tags)
				{
					tiaHmiSoftwareInfo.Tags.Add(new TiaHmiTagInfo
					{
						Id = text + "/" + tag.Name,
						Name = tag.Name
					});
				}
			}
		}
		catch
		{
		}
		try
		{
			foreach (HmiConnection connection in hmiSoftware.Connections)
			{
				tiaHmiSoftwareInfo.Connections.Add(new TiaHmiConnectionInfo
				{
					Id = text + "/" + connection.Name,
					Name = connection.Name
				});
			}
		}
		catch
		{
		}
		try
		{
			foreach (HmiTag tag2 in hmiSoftware.Tags)
			{
				string tagId = text + "/" + tag2.Name;
				if (!tiaHmiSoftwareInfo.Tags.Exists((TiaHmiTagInfo t) => t.Id == tagId))
				{
					tiaHmiSoftwareInfo.Tags.Add(new TiaHmiTagInfo
					{
						Id = tagId,
						Name = tag2.Name
					});
				}
			}
		}
		catch
		{
		}
		return tiaHmiSoftwareInfo;
	}

	private TiaHmiScreenGroupInfo BuildHmiUnifiedScreenGroupStructure(HmiScreenGroup screenGroup, string parentId)
	{
		string text = parentId + "/" + screenGroup.Name;
		TiaHmiScreenGroupInfo tiaHmiScreenGroupInfo = new TiaHmiScreenGroupInfo
		{
			Id = text,
			Name = screenGroup.Name,
			ParentId = parentId,
			Screens = new List<TiaHmiScreenInfo>(),
			SubGroups = new List<TiaHmiScreenGroupInfo>()
		};
		try
		{
			foreach (HmiScreen screen in screenGroup.Screens)
			{
				tiaHmiScreenGroupInfo.Screens.Add(new TiaHmiScreenInfo
				{
					Id = text + "/" + ((HmiScreenBase)screen).Name,
					Name = ((HmiScreenBase)screen).Name,
					ScreenType = "Screen"
				});
			}
		}
		catch
		{
		}
		try
		{
			foreach (HmiScreenGroup group in screenGroup.Groups)
			{
				tiaHmiScreenGroupInfo.SubGroups.Add(BuildHmiUnifiedScreenGroupStructure(group, text));
			}
		}
		catch
		{
		}
		tiaHmiScreenGroupInfo.Screens = tiaHmiScreenGroupInfo.Screens.OrderBy<TiaHmiScreenInfo, string>((TiaHmiScreenInfo s) => s.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaHmiScreenGroupInfo.SubGroups = tiaHmiScreenGroupInfo.SubGroups.OrderBy<TiaHmiScreenGroupInfo, string>((TiaHmiScreenGroupInfo g) => g.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaHmiScreenGroupInfo;
	}

	private TiaHmiTagGroupInfo BuildHmiUnifiedTagTableGroupStructure(HmiTagTableGroup tagGroup, string parentId)
	{
		string text = parentId + "/" + tagGroup.Name;
		TiaHmiTagGroupInfo tiaHmiTagGroupInfo = new TiaHmiTagGroupInfo
		{
			Id = text,
			Name = tagGroup.Name,
			ParentId = parentId,
			Tags = new List<TiaHmiTagInfo>(),
			SubGroups = new List<TiaHmiTagGroupInfo>()
		};
		try
		{
			foreach (HmiTagTable tagTable in tagGroup.TagTables)
			{
				foreach (HmiTag tag in tagTable.Tags)
				{
					tiaHmiTagGroupInfo.Tags.Add(new TiaHmiTagInfo
					{
						Id = text + "/" + tag.Name,
						Name = tag.Name
					});
				}
			}
		}
		catch
		{
		}
		try
		{
			foreach (HmiTagTableGroup group in tagGroup.Groups)
			{
				tiaHmiTagGroupInfo.SubGroups.Add(BuildHmiUnifiedTagTableGroupStructure(group, text));
			}
		}
		catch
		{
		}
		tiaHmiTagGroupInfo.Tags = tiaHmiTagGroupInfo.Tags.OrderBy<TiaHmiTagInfo, string>((TiaHmiTagInfo t) => t.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaHmiTagGroupInfo.SubGroups = tiaHmiTagGroupInfo.SubGroups.OrderBy<TiaHmiTagGroupInfo, string>((TiaHmiTagGroupInfo g) => g.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaHmiTagGroupInfo;
	}

	private TiaHmiScreenGroupInfo BuildHmiScreenGroupStructure(ScreenFolder folder, string name, string parentId)
	{
		string text = parentId + "/" + name;
		TiaHmiScreenGroupInfo tiaHmiScreenGroupInfo = new TiaHmiScreenGroupInfo
		{
			Id = text,
			Name = name,
			ParentId = parentId,
			Screens = new List<TiaHmiScreenInfo>(),
			SubGroups = new List<TiaHmiScreenGroupInfo>()
		};
		try
		{
			foreach (Screen screen in folder.Screens)
			{
				tiaHmiScreenGroupInfo.Screens.Add(new TiaHmiScreenInfo
				{
					Id = text + "/" + screen.Name,
					Name = screen.Name,
					ScreenType = "Screen"
				});
			}
		}
		catch
		{
		}
		try
		{
			foreach (ScreenUserFolder folder2 in folder.Folders)
			{
				tiaHmiScreenGroupInfo.SubGroups.Add(BuildHmiScreenUserFolderStructure(folder2, text));
			}
		}
		catch
		{
		}
		tiaHmiScreenGroupInfo.Screens = tiaHmiScreenGroupInfo.Screens.OrderBy<TiaHmiScreenInfo, string>((TiaHmiScreenInfo s) => s.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaHmiScreenGroupInfo.SubGroups = tiaHmiScreenGroupInfo.SubGroups.OrderBy<TiaHmiScreenGroupInfo, string>((TiaHmiScreenGroupInfo g) => g.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaHmiScreenGroupInfo;
	}

	private TiaHmiScreenGroupInfo BuildHmiScreenUserFolderStructure(ScreenUserFolder folder, string parentId)
	{
		string text = parentId + "/" + folder.Name;
		TiaHmiScreenGroupInfo tiaHmiScreenGroupInfo = new TiaHmiScreenGroupInfo
		{
			Id = text,
			Name = folder.Name,
			ParentId = parentId,
			Screens = new List<TiaHmiScreenInfo>(),
			SubGroups = new List<TiaHmiScreenGroupInfo>()
		};
		try
		{
			foreach (Screen screen in folder.Screens)
			{
				tiaHmiScreenGroupInfo.Screens.Add(new TiaHmiScreenInfo
				{
					Id = text + "/" + screen.Name,
					Name = screen.Name,
					ScreenType = "Screen"
				});
			}
		}
		catch
		{
		}
		try
		{
			foreach (ScreenUserFolder folder2 in folder.Folders)
			{
				tiaHmiScreenGroupInfo.SubGroups.Add(BuildHmiScreenUserFolderStructure(folder2, text));
			}
		}
		catch
		{
		}
		tiaHmiScreenGroupInfo.Screens = tiaHmiScreenGroupInfo.Screens.OrderBy<TiaHmiScreenInfo, string>((TiaHmiScreenInfo s) => s.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaHmiScreenGroupInfo.SubGroups = tiaHmiScreenGroupInfo.SubGroups.OrderBy<TiaHmiScreenGroupInfo, string>((TiaHmiScreenGroupInfo g) => g.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaHmiScreenGroupInfo;
	}

	private TiaHmiTagGroupInfo BuildHmiTagGroupStructure(TagFolder folder, string name, string parentId)
	{
		string text = parentId + "/" + name;
		TiaHmiTagGroupInfo tiaHmiTagGroupInfo = new TiaHmiTagGroupInfo
		{
			Id = text,
			Name = name,
			ParentId = parentId,
			Tags = new List<TiaHmiTagInfo>(),
			SubGroups = new List<TiaHmiTagGroupInfo>()
		};
		try
		{
			foreach (TagTable tagTable in folder.TagTables)
			{
				foreach (Tag tag in tagTable.Tags)
				{
					tiaHmiTagGroupInfo.Tags.Add(new TiaHmiTagInfo
					{
						Id = text + "/" + tag.Name,
						Name = tag.Name
					});
				}
			}
		}
		catch
		{
		}
		try
		{
			foreach (TagUserFolder folder2 in folder.Folders)
			{
				tiaHmiTagGroupInfo.SubGroups.Add(BuildHmiTagUserFolderStructure(folder2, text));
			}
		}
		catch
		{
		}
		tiaHmiTagGroupInfo.Tags = tiaHmiTagGroupInfo.Tags.OrderBy<TiaHmiTagInfo, string>((TiaHmiTagInfo t) => t.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaHmiTagGroupInfo.SubGroups = tiaHmiTagGroupInfo.SubGroups.OrderBy<TiaHmiTagGroupInfo, string>((TiaHmiTagGroupInfo g) => g.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaHmiTagGroupInfo;
	}

	private TiaHmiTagGroupInfo BuildHmiTagUserFolderStructure(TagUserFolder folder, string parentId)
	{
		string text = parentId + "/" + folder.Name;
		TiaHmiTagGroupInfo tiaHmiTagGroupInfo = new TiaHmiTagGroupInfo
		{
			Id = text,
			Name = folder.Name,
			ParentId = parentId,
			Tags = new List<TiaHmiTagInfo>(),
			SubGroups = new List<TiaHmiTagGroupInfo>()
		};
		try
		{
			foreach (TagTable tagTable in folder.TagTables)
			{
				foreach (Tag tag in tagTable.Tags)
				{
					tiaHmiTagGroupInfo.Tags.Add(new TiaHmiTagInfo
					{
						Id = text + "/" + tag.Name,
						Name = tag.Name
					});
				}
			}
		}
		catch
		{
		}
		try
		{
			foreach (TagUserFolder folder2 in folder.Folders)
			{
				tiaHmiTagGroupInfo.SubGroups.Add(BuildHmiTagUserFolderStructure(folder2, text));
			}
		}
		catch
		{
		}
		tiaHmiTagGroupInfo.Tags = tiaHmiTagGroupInfo.Tags.OrderBy<TiaHmiTagInfo, string>((TiaHmiTagInfo t) => t.Name, StringComparer.OrdinalIgnoreCase).ToList();
		tiaHmiTagGroupInfo.SubGroups = tiaHmiTagGroupInfo.SubGroups.OrderBy<TiaHmiTagGroupInfo, string>((TiaHmiTagGroupInfo g) => g.Name, StringComparer.OrdinalIgnoreCase).ToList();
		return tiaHmiTagGroupInfo;
	}

	private string GetProjectVersion(ProjectBase project)
	{
		try
		{
			return TiaConnector.GetInitializedVersionString();
		}
		catch
		{
			return "Unknown";
		}
	}

	private string GetDeviceType(Device device)
	{
		try
		{
			string typeIdentifier = ((HardwareObject)device).TypeIdentifier;
			if (typeIdentifier.Contains("CPU"))
			{
				return "PLC";
			}
			if (typeIdentifier.Contains("HMI"))
			{
				return "HMI";
			}
			if (typeIdentifier.Contains("Drive"))
			{
				return "Drive";
			}
			if (typeIdentifier.Contains("IM") || typeIdentifier.Contains("ET"))
			{
				return "DistributedIO";
			}
			return "Device";
		}
		catch
		{
			return "Device";
		}
	}

	private string DetermineDeviceType(Device device, TiaDeviceInfo deviceInfo)
	{
		try
		{
			if (deviceInfo.PlcSoftware.Count > 0)
			{
				return "PLC";
			}
			if (deviceInfo.HmiSoftware.Count > 0)
			{
				return "HMI";
			}
			string text = ((HardwareObject)device).TypeIdentifier ?? "";
			if (text.Contains("IM") || text.Contains("ET") || text.Contains("GSD") || text.Contains("Distributed"))
			{
				return "DistributedIO";
			}
			if (text.Contains("Drive") || text.Contains("SINAMICS") || text.Contains("G120") || text.Contains("S120"))
			{
				return "Drive";
			}
			if (text.Contains("SCALANCE") || text.Contains("Switch") || text.Contains("Router") || text.Contains("CP"))
			{
				return "Device";
			}
			if (text.Contains("PC") || text.Contains("IPC") || text.Contains("PC-System"))
			{
				return "Computer";
			}
			return "Device";
		}
		catch
		{
			return "Device";
		}
	}

	private string GetDeviceDisplayName(Device device)
	{
		try
		{
			string text = FindUserDefinedDeviceName(((HardwareObject)device).DeviceItems);
			if (!string.IsNullOrEmpty(text))
			{
				return text;
			}
			return ((HardwareObject)device).Name ?? "Unknown";
		}
		catch
		{
			return ((HardwareObject)device).Name ?? "Unknown";
		}
	}

	private string? FindUserDefinedDeviceName(DeviceItemComposition items)
	{
		foreach (DeviceItem item in items)
		{
			switch (GetDeviceItemClassification(item))
			{
			case "CPU":
			case "Head":
			case "InterfaceModule":
			case "HM":
				if (!string.IsNullOrEmpty(((HardwareObject)item).Name))
				{
					return ((HardwareObject)item).Name;
				}
				break;
			}
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				string text = FindUserDefinedDeviceName(((HardwareObject)item).DeviceItems);
				if (!string.IsNullOrEmpty(text))
				{
					return text;
				}
			}
		}
		return null;
	}

	private string GetDeviceItemClassification(DeviceItem item)
	{
		try
		{
			return ((HardwareObject)item).GetAttribute("Classification")?.ToString() ?? "";
		}
		catch
		{
			return "";
		}
	}

	private string GetBlockType(PlcBlock block)
	{
		if (block is OB)
		{
			return "OB";
		}
		if (block is FB)
		{
			return "FB";
		}
		if (block is FC)
		{
			return "FC";
		}
		if (block is InstanceDB)
		{
			return "InstanceDB";
		}
		if (block is DataBlock)
		{
			return "DB";
		}
		return "Block";
	}

	private int GetBlockNumber(PlcBlock block)
	{
		try
		{
			return block.Number;
		}
		catch
		{
			return 0;
		}
	}

	private string GetBlockLanguage(PlcBlock block)
	{
		//IL_0001: Unknown result type (might be due to invalid IL or missing references)
		//IL_0006: Unknown result type (might be due to invalid IL or missing references)
		try
		{
			return ((object)block.ProgrammingLanguage/*cast due to constrained. prefix*/).ToString();
		}
		catch
		{
			return "Unknown";
		}
	}
}
